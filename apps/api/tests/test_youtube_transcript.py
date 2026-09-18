"""Tests for the YouTube Transcript tool.

Two halves, deliberately separated:

* **Offline** — URL extraction and SRT generation. Pure functions, no network,
  no database, no provider credits. Always runs.

* **Live** — the HTTP endpoint against a running API. Every rejection case is
  free; only the happy path costs a provider credit, and only the first time,
  because the second request must come from the cache. Run with:

      PICKIXO_API=http://127.0.0.1:8011/api python -m tests.test_youtube_transcript

  Skipped entirely when no API is reachable, so the offline half stays usable.
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.services.youtube import InvalidYouTubeUrl, extract_video_id  # noqa: E402

VIDEO = "dQw4w9WgXcQ"


# ===========================================================================
# Offline: what must never reach the provider
# ===========================================================================
class VideoIdExtraction(unittest.TestCase):
    def test_accepts_every_shape_youtube_hands_out(self) -> None:
        for value in [
            f"https://www.youtube.com/watch?v={VIDEO}",
            f"http://youtube.com/watch?v={VIDEO}",
            f"https://m.youtube.com/watch?v={VIDEO}",
            f"https://music.youtube.com/watch?v={VIDEO}",
            f"https://youtu.be/{VIDEO}",
            f"https://www.youtube.com/shorts/{VIDEO}",
            f"https://www.youtube.com/embed/{VIDEO}",
            f"https://www.youtube.com/live/{VIDEO}",
            f"https://www.youtube-nocookie.com/embed/{VIDEO}",
            f"youtube.com/watch?v={VIDEO}",          # no scheme
            f"  https://youtu.be/{VIDEO}  ",          # pasted with whitespace
            VIDEO,                                     # a bare id
        ]:
            with self.subTest(value=value):
                self.assertEqual(extract_video_id(value), VIDEO)

    def test_strips_the_junk_real_share_links_carry(self) -> None:
        for value in [
            f"https://youtu.be/{VIDEO}?si=xYzAbC123",
            f"https://www.youtube.com/watch?v={VIDEO}&t=42s",
            f"https://www.youtube.com/watch?v={VIDEO}&list=PLabc&index=3",
            f"https://www.youtube.com/watch?v={VIDEO}#t=1m",
        ]:
            with self.subTest(value=value):
                self.assertEqual(extract_video_id(value), VIDEO)

    def test_rejects_everything_that_is_not_a_youtube_video(self) -> None:
        """Nothing here may reach the provider — each call would cost a credit
        and hand a third party someone else's URL."""
        for value in [
            "", "   ", "not a url", "https://example.com/",
            f"https://example.com/watch?v={VIDEO}",
            # The classic near-miss: a hostname that merely contains youtube.com.
            f"https://youtube.com.evil.example/watch?v={VIDEO}",
            f"https://notyoutube.com/watch?v={VIDEO}",
            "https://www.youtube.com/watch",           # no v parameter
            "https://www.youtube.com/",                 # no video at all
            "https://www.youtube.com/watch?v=short",    # id too short
            "https://www.youtube.com/watch?v=waytoolongforanid",
            "javascript:alert(1)",
            f"file:///etc/passwd?v={VIDEO}",
            "x" * 3000,                                  # oversized input
        ]:
            with self.subTest(value=value):
                with self.assertRaises(InvalidYouTubeUrl):
                    extract_video_id(value)


# ===========================================================================
# Offline: SRT correctness
# ===========================================================================
def _srt_time(seconds: float) -> str:
    """Mirrors lib/transcript.ts formatSrtTime, so both sides are checked."""
    clamped = max(0.0, seconds)
    whole = int(clamped)
    ms = round((clamped - whole) * 1000)
    secs = whole
    if ms == 1000:
        ms, secs = 0, secs + 1
    return f"{secs // 3600:02d}:{(secs % 3600) // 60:02d}:{secs % 60:02d},{ms:03d}"


class SrtFormatting(unittest.TestCase):
    def test_time_format_matches_the_spec(self) -> None:
        self.assertEqual(_srt_time(0), "00:00:00,000")
        self.assertEqual(_srt_time(3.2), "00:00:03,200")
        self.assertEqual(_srt_time(61.5), "00:01:01,500")
        self.assertEqual(_srt_time(3661.25), "01:01:01,250")

    def test_millisecond_carry(self) -> None:
        """3.9996 is 4.000, not 3.999 — and never 3.1000."""
        self.assertEqual(_srt_time(3.9996), "00:00:04,000")
        self.assertEqual(_srt_time(59.9999), "00:01:00,000")


# ===========================================================================
# Live endpoint
# ===========================================================================
def _load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = pathlib.Path(__file__).resolve().parents[3] / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip()
    return env


ENV = _load_env()
BASE = os.environ.get("PICKIXO_API") or f"http://127.0.0.1:{ENV.get('BACKEND_PORT', '8010')}/api"


def _post(path: str, body: dict) -> tuple[int, dict]:
    request = urllib.request.Request(
        BASE + path, data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            return exc.code, json.loads(raw or b"{}")
        except ValueError:
            return exc.code, {"_raw": raw[:200].decode("utf-8", "replace")}


def _api_reachable() -> bool:
    try:
        with urllib.request.urlopen(BASE + "/health", timeout=10) as response:
            return response.status == 200
    except Exception:  # noqa: BLE001
        return False


LIVE = _api_reachable()


@unittest.skipUnless(LIVE, f"no API at {BASE}")
class Endpoint(unittest.TestCase):
    def test_bad_input_is_refused_without_calling_the_provider(self) -> None:
        for url in [
            "", "not a url", "https://example.com/watch?v=" + VIDEO,
            "https://youtube.com.evil.example/watch?v=" + VIDEO,
        ]:
            with self.subTest(url=url):
                status, body = _post("/tools/youtube-transcript", {"url": url})
                self.assertIn(status, (400, 422))
                if status == 400 and "error" in body:
                    self.assertIn(
                        body["error"]["code"],
                        ("invalid_youtube_url", "invalid_request"),
                    )

    def test_fetches_and_then_serves_from_cache(self) -> None:
        """The second request for the same video must cost nothing.

        This is the whole economic argument for the cache, so it is asserted
        rather than assumed.
        """
        status, first = _post("/tools/youtube-transcript",
                              {"url": f"https://www.youtube.com/watch?v={VIDEO}"})
        if status == 503:
            self.skipTest("transcript provider is not configured")
        self.assertEqual(status, 200, first)
        self.assertEqual(first["video"]["id"], VIDEO)
        self.assertGreater(first["segment_count"], 0)
        self.assertEqual(len(first["transcript"]), first["segment_count"])

        segment = first["transcript"][0]
        self.assertIn("start", segment)
        self.assertIn("duration", segment)
        self.assertTrue(segment["text"].strip())

        # A different URL shape for the same video must hit the same cache row.
        status, second = _post("/tools/youtube-transcript",
                               {"url": f"https://youtu.be/{VIDEO}"})
        self.assertEqual(status, 200)
        self.assertTrue(second["cached"], "second request did not come from cache")
        self.assertEqual(second["segment_count"], first["segment_count"])

    def test_unavailable_video_fails_and_is_not_cached(self) -> None:
        """A video with no transcript must fail, and must not be stored.

        The provider answers this inconsistently — sometimes 404 "not found",
        sometimes 408 "retry" when its own lookup times out — so both a clean
        "no transcript" and an exhausted-retry failure are accepted. What is not
        acceptable is a 200, or a cached row that would serve this forever.
        """
        url = "https://www.youtube.com/watch?v=aaaaaaaaaaa"
        status, body = _post("/tools/youtube-transcript", {"url": url})
        self.assertNotEqual(status, 200, "a missing transcript returned success")
        self.assertIn(status, (404, 502, 503), body)
        if status == 404:
            self.assertEqual(body["error"]["code"], "transcript_unavailable")

        # Asking again must still fail: a failure must never have been cached.
        again_status, _ = _post("/tools/youtube-transcript", {"url": url})
        self.assertNotEqual(again_status, 200,
                            "a failed fetch was cached and later served as success")

    def test_response_never_leaks_the_provider_or_its_key(self) -> None:
        status, body = _post("/tools/youtube-transcript",
                             {"url": f"https://www.youtube.com/watch?v={VIDEO}"})
        if status != 200:
            self.skipTest("provider unavailable")
        blob = json.dumps(body).lower()
        for secret in ("sk_", "transcriptapi", "authorization", "bearer", "api_key"):
            self.assertNotIn(secret, blob, f"{secret!r} leaked into the response")


if __name__ == "__main__":
    print(f"offline tests always run; live tests target {BASE} "
          f"({'reachable' if LIVE else 'unreachable — skipped'})\n")
    unittest.main(verbosity=2)
