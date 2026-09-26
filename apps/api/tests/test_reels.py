"""Tests for reels: the script parser, captions, the hook client, the Reels
upload calls, and a real ffmpeg render.

What these protect:

1. **A bad script never reaches the renderer.** Every field becomes something
   on screen or in someone's ear, so the parser refuses rather than repairs.
2. **Captions cannot be hijacked.** Narration is model-written; ASS override
   syntax in it must render as text.
3. **The hook is optional.** Any failure of the paid clip is HookUnavailable,
   which the renderer turns into a still opening — never a failed reel.
4. **The Reels upload speaks Meta's protocol**: OAuth header and offset/
   file_size on rupload, finish with video_state=PUBLISHED.

The network is mocked with httpx.MockTransport. The render test runs the real
ffmpeg on generated stills and a silent WAV (no Piper, no AI), and is skipped
if ffmpeg is not on PATH.

    cd apps/api && python -m tests.test_reels
"""
from __future__ import annotations

import asyncio
import io
import json
import pathlib
import shutil
import sys
import tempfile
import unittest
import wave

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.facebook_agent import actions  # noqa: E402
from app.facebook_agent.decision import (  # noqa: E402
    DecisionParseError, apply_fact_check, parse_reel_script,
)
from app.services.facebook import FacebookClient, PageRef  # noqa: E402
from app.services.video import captions, compose, hook  # noqa: E402
from app.services.video.reel import MIN_SCENE_SECONDS, let_clip_play  # noqa: E402


def good_script(**overrides) -> dict:
    script = {
        "format": "facts",
        "topic": "Octopus hearts",
        "animal": "octopus",
        "hook_line": "This animal has three hearts.",
        "hook_visual": "an octopus on a reef",
        "hook_motion": "the octopus drifts forward, camera slowly pushes in",
        "beats": [
            {"line": "Two hearts pump blood through the gills.", "visual": "gills"},
            {"line": "The third pumps it to the rest of the body.", "visual": "body"},
            {"line": "That one stops while it swims, so it prefers to crawl.",
             "visual": "crawling"},
        ],
        "question": "Which animal fact surprised you most?",
        "caption": "An octopus has three hearts, and one stops when it swims.",
        "hashtags": ["#animalfacts", "#octopus", "#wildlife"],
    }
    script.update(overrides)
    return script


# ===========================================================================
# The script parser refuses rather than repairs
# ===========================================================================
class ScriptParsing(unittest.TestCase):
    def test_a_good_script_parses(self) -> None:
        script = parse_reel_script(good_script())
        self.assertEqual(script.format, "facts")
        self.assertEqual(len(script.beats), 3)
        # Narration is hook, beats, question — one line per scene.
        self.assertEqual(len(script.lines), 5)
        self.assertEqual(script.lines[0], "This animal has three hearts.")
        self.assertEqual(script.lines[-1], "Which animal fact surprised you most?")
        # Stills: the hook's, then one per beat. The closing scene reuses the
        # hook's still, so it costs no extra image.
        self.assertEqual(len(script.visuals), 4)

    def test_unknown_format_is_refused(self) -> None:
        with self.assertRaises(DecisionParseError):
            parse_reel_script(good_script(format="documentary"))

    def test_beat_count_is_bounded(self) -> None:
        beat = {"line": "A fact.", "visual": "a still"}
        for beats in ([beat] * 2, [beat] * 6, "not a list"):
            with self.subTest(n=len(beats) if isinstance(beats, list) else beats):
                with self.assertRaises(DecisionParseError):
                    parse_reel_script(good_script(beats=beats))

    def test_overlong_hook_is_refused_not_cut(self) -> None:
        """Cutting a hook mid-sentence produces a hook that says nothing."""
        with self.assertRaises(DecisionParseError):
            parse_reel_script(good_script(hook_line=" ".join(["word"] * 25)))

    def test_a_beat_without_a_visual_is_refused(self) -> None:
        """A missing visual would be a black scene."""
        beats = good_script()["beats"]
        beats[1] = {"line": "A fact.", "visual": ""}
        with self.assertRaises(DecisionParseError):
            parse_reel_script(good_script(beats=beats))

    def test_hashtags_are_sanitised(self) -> None:
        script = parse_reel_script(good_script(hashtags=[
            "animalfacts", "#AnimalFacts", "#two words", "#ok_tag", "#<script>",
            "#a", "#one", "#two", "#three", "#four",
        ]))
        self.assertEqual(script.hashtags[0], "#animalfacts")
        self.assertNotIn("#AnimalFacts", script.hashtags, "case-insensitive dedupe")
        self.assertTrue(all(" " not in t and "<" not in t for t in script.hashtags))
        self.assertLessEqual(len(script.hashtags), 5)

    def test_no_usable_hashtags_falls_back(self) -> None:
        script = parse_reel_script(good_script(hashtags=["##", "#"]))
        self.assertEqual(script.hashtags, ["#animalfacts", "#wildlife"])

    def test_caption_carries_tags_and_disclosure(self) -> None:
        script = parse_reel_script(good_script())
        caption = actions.reel_caption(script)
        self.assertTrue(caption.startswith(script.caption))
        self.assertIn("#octopus", caption)
        self.assertTrue(caption.endswith(actions.AI_DISCLOSURE),
                        "the AI disclosure is always there")


# ===========================================================================
# Fact-check: the second pass that doubts
# ===========================================================================
def mantis() -> dict:
    """The script that prompted this: true beats under a false hook."""
    return good_script(
        topic="Mantis shrimp strike", animal="mantis shrimp",
        hook_line="A shrimp can strike faster than a bullet.",
        caption="A shrimp can strike faster than a bullet.",
    )


class FactCheck(unittest.TestCase):
    def test_ok_passes_the_script_through_unchanged(self) -> None:
        script = parse_reel_script(mantis())
        checked = apply_fact_check(script, {"verdict": "ok", "issues": []})
        self.assertEqual(checked.hook_line, script.hook_line)
        self.assertIn("no issues", checked.fact_check)

    def test_fixed_rewrites_the_words_and_keeps_the_pictures(self) -> None:
        script = parse_reel_script(mantis())
        checked = apply_fact_check(script, {
            "verdict": "fixed",
            "issues": ["speed confused with acceleration"],
            "hook_line": "This shrimp punches with the acceleration of a bullet.",
            "beats": [b.line for b in script.beats],
            "question": script.question,
            "caption": "This shrimp punches with the acceleration of a bullet.",
        })
        self.assertNotIn("faster than a bullet", checked.hook_line)
        self.assertNotIn("faster than a bullet", checked.caption)
        self.assertEqual([b.visual for b in checked.beats],
                         [b.visual for b in script.beats])
        self.assertEqual(checked.hook_visual, script.hook_visual)
        self.assertIn("speed confused with acceleration", checked.fact_check)

    def test_reject_stops_the_reel_and_says_why(self) -> None:
        script = parse_reel_script(mantis())
        with self.assertRaises(DecisionParseError) as ctx:
            apply_fact_check(script, {"verdict": "reject",
                                      "issues": ["the central claim is a myth"]})
        self.assertIn("myth", str(ctx.exception))

    def test_a_fix_must_keep_the_shape(self) -> None:
        script = parse_reel_script(mantis())
        base = {"verdict": "fixed", "issues": ["x"], "question": script.question,
                "caption": script.caption}
        bad = [
            {**base, "hook_line": script.hook_line, "beats": ["only one"]},
            {**base, "hook_line": " ".join(["long"] * 30),
             "beats": [b.line for b in script.beats]},
        ]
        for payload in bad:
            with self.subTest(payload=str(payload)[:60]):
                with self.assertRaises(DecisionParseError):
                    apply_fact_check(script, payload)

    def test_no_verdict_is_not_a_pass(self) -> None:
        script = parse_reel_script(mantis())
        for payload in ({}, {"verdict": "probably fine"}):
            with self.assertRaises(DecisionParseError):
                apply_fact_check(script, payload)

    def test_draft_reel_always_runs_the_check(self) -> None:
        """Two calls, in order: write, then doubt. The check's correction is
        what comes back."""
        from app.facebook_agent import decision
        from app.facebook_agent.state import (
            AgentState, AutomationState, PageSnapshot, TodayActivity,
        )
        calls: list[str] = []
        replies = [
            json.dumps(mantis()),
            json.dumps({"verdict": "fixed", "issues": ["speed vs acceleration"],
                        "hook_line": "This shrimp hits with a bullet's acceleration.",
                        "beats": [b["line"] for b in mantis()["beats"]],
                        "question": mantis()["question"],
                        "caption": "This shrimp hits with a bullet's acceleration."}),
        ]

        async def fake_generate(*, prompt, system, max_tokens, capability):
            calls.append(capability)
            return replies[len(calls) - 1]

        original = decision.ai_service.generate_for_system
        decision.ai_service.generate_for_system = fake_generate
        try:
            from datetime import datetime, timezone
            state = AgentState(page=PageSnapshot(name="X", page_id="1"),
                               automation=AutomationState(),
                               today=TodayActivity(),
                               observed_at=datetime.now(timezone.utc))
            script = asyncio.run(decision.draft_reel(state, topic=None, animal=None))
        finally:
            decision.ai_service.generate_for_system = original

        self.assertEqual(calls, ["agent_content", "agent_fact_check"])
        self.assertNotIn("faster than a bullet", script.hook_line)
        self.assertTrue(script.fact_check.startswith("corrected"))


class HookTiming(unittest.TestCase):
    def test_the_clip_plays_out_under_the_next_line(self) -> None:
        for got, want in zip(let_clip_play([2.8, 4.0, 3.0], 5.0), [5.0, 1.8, 3.0]):
            self.assertAlmostEqual(got, want)

    def test_total_length_is_unchanged(self) -> None:
        before = [2.8, 4.0, 3.0, 2.5]
        self.assertAlmostEqual(sum(let_clip_play(before, 5.0)), sum(before))

    def test_the_next_scene_keeps_its_minimum(self) -> None:
        stretched = let_clip_play([1.0, 2.0, 3.0], 5.0)
        self.assertAlmostEqual(stretched[1], MIN_SCENE_SECONDS)
        self.assertAlmostEqual(stretched[0], 1.5)

    def test_a_long_hook_line_is_left_alone(self) -> None:
        self.assertEqual(let_clip_play([6.0, 4.0], 5.0), [6.0, 4.0])


# ===========================================================================
# Captions
# ===========================================================================
class Captions(unittest.TestCase):
    def test_chunks_are_short(self) -> None:
        line = ("When an octopus swims, the heart that serves its body stops "
                "beating, which is why it would rather crawl along the bottom.")
        chunks = captions.chunk_words(line)
        self.assertTrue(all(len(c.split()) <= captions.MAX_WORDS for c in chunks))
        self.assertEqual(" ".join(chunks), line, "no words lost or added")

    def test_breaks_after_punctuation(self) -> None:
        chunks = captions.chunk_words("Owls cannot move their eyes, so they turn their heads.")
        self.assertTrue(chunks[0].endswith(","), chunks)

    def test_a_sentence_never_spans_two_captions(self) -> None:
        chunks = captions.chunk_words(
            "Over a short sprint the cheetah wins. Over distance, the pronghorn pulls away.")
        for chunk in chunks:
            self.assertNotRegex(chunk, r"[.!?] \S", f"sentence break inside {chunk!r}")

    def test_no_dangling_single_word(self) -> None:
        chunks = captions.chunk_words("one two three four five six")
        self.assertNotEqual(len(chunks[-1].split()), 1, chunks)

    def test_cues_fill_the_line_exactly(self) -> None:
        cues = captions.cues_for_line("Two hearts pump blood through the gills.",
                                      start=2.0, duration=3.0)
        self.assertAlmostEqual(cues[0].start, 2.0)
        self.assertAlmostEqual(cues[-1].end, 5.0)
        for prev, nxt in zip(cues, cues[1:]):
            self.assertAlmostEqual(prev.end, nxt.start)

    def test_override_syntax_in_narration_renders_as_text(self) -> None:
        """A model-written line must not be able to move or restyle captions."""
        cues = [captions.Cue(0, 1, r"{\pos(0,0)}gotcha\N")]
        ass = captions.build_ass(cues)
        dialogue = [l for l in ass.splitlines() if l.startswith("Dialogue:")][0]
        text = dialogue.split(",,", 1)[1].split(",", 4)[-1]
        self.assertNotIn("{", text)
        self.assertNotIn("\\", text)

    def test_hook_style_only_for_the_hook(self) -> None:
        cues = [captions.Cue(0, 1, "hook"), captions.Cue(1.5, 2.5, "body")]
        ass = captions.build_ass(cues, hook_until=1.2)
        events = [l for l in ass.splitlines() if l.startswith("Dialogue:")]
        self.assertIn(",Hook,", events[0])
        self.assertIn(",Body,", events[1])

    def test_timestamp_format(self) -> None:
        self.assertEqual(captions._timestamp(3723.456), "1:02:03.46")


# ===========================================================================
# The hook: optional, and never fatal
# ===========================================================================
def tiny_png() -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (72, 128), (40, 90, 60)).save(buf, "PNG")
    return buf.getvalue()


class Hook(unittest.TestCase):
    def setUp(self) -> None:
        # Polling sleeps between status checks; not in a test.
        self._poll = hook._POLL_SECONDS
        hook._POLL_SECONDS = 0

    def tearDown(self) -> None:
        hook._POLL_SECONDS = self._poll

    def run_hook(self, handler, **kwargs) -> bytes:
        async def go():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
                return await hook.generate_hook(
                    image=tiny_png(), motion_prompt="the fox walks",
                    fal_key=kwargs.pop("fal_key", "k-test"),
                    model="wan/v2.6/image-to-video/flash", client=http, **kwargs,
                )
        return asyncio.run(go())

    def test_happy_path_follows_the_urls_fal_returns(self) -> None:
        seen: list[tuple[str, str, str | None]] = []
        statuses = iter(["IN_QUEUE", "IN_PROGRESS", "COMPLETED"])

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append((request.method, str(request.url),
                         request.headers.get("authorization")))
            url = str(request.url)
            if request.method == "POST":
                body = json.loads(request.content)
                self.assertFalse(body["generate_audio"], "silent is half price")
                self.assertEqual(body["resolution"], "720p")
                self.assertTrue(body["image_url"].startswith("data:image/jpeg;base64,"))
                return httpx.Response(200, json={
                    "request_id": "r1",
                    "status_url": "https://queue.example/r1/status",
                    "response_url": "https://queue.example/r1",
                })
            if url.endswith("/status"):
                return httpx.Response(200, json={"status": next(statuses)})
            if url == "https://queue.example/r1":
                return httpx.Response(200, json={"video": {"url": "https://cdn.example/v.mp4"}})
            if url == "https://cdn.example/v.mp4":
                return httpx.Response(200, content=b"MP4DATA")
            return httpx.Response(404)

        self.assertEqual(self.run_hook(handler), b"MP4DATA")
        self.assertEqual(seen[0][1], "https://queue.fal.run/wan/v2.6/image-to-video/flash")
        self.assertEqual(seen[0][2], "Key k-test")
        # The key goes to fal, never to the CDN that serves the file.
        cdn = [s for s in seen if "cdn.example" in s[1]]
        self.assertTrue(cdn)
        self.assertIsNone(cdn[0][2])

    def test_every_failure_is_hook_unavailable(self) -> None:
        cases = {
            "refused": lambda r: httpx.Response(402, json={"detail": "no credit"}),
            "no urls": lambda r: httpx.Response(200, json={"request_id": "x"}),
        }

        def job_failed(request: httpx.Request) -> httpx.Response:
            if request.method == "POST":
                return httpx.Response(200, json={"status_url": "https://q/s",
                                                 "response_url": "https://q/r"})
            return httpx.Response(200, json={"status": "FAILED"})
        cases["job failed"] = job_failed

        def no_video(request: httpx.Request) -> httpx.Response:
            if request.method == "POST":
                return httpx.Response(200, json={"status_url": "https://q/s",
                                                 "response_url": "https://q/r"})
            if str(request.url).endswith("/s"):
                return httpx.Response(200, json={"status": "COMPLETED"})
            return httpx.Response(200, json={"video": None})
        cases["no video"] = no_video

        for name, handler in cases.items():
            with self.subTest(name):
                with self.assertRaises(hook.HookUnavailable):
                    self.run_hook(handler)

    def test_no_key_never_calls_out(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise AssertionError("no request may be made without a key")
        with self.assertRaises(hook.HookUnavailable):
            self.run_hook(handler, fal_key="")


# ===========================================================================
# The Reels upload protocol
# ===========================================================================
class ReelUpload(unittest.TestCase):
    def test_three_phases(self) -> None:
        calls: list[httpx.Request] = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(request)
            if "rupload" in str(request.url):
                return httpx.Response(200, json={"success": True})
            form = dict(httpx.QueryParams(request.content.decode()))
            if form.get("upload_phase") == "start":
                return httpx.Response(200, json={
                    "video_id": "v123",
                    "upload_url": "https://rupload.facebook.com/video-upload/v25.0/v123",
                })
            if form.get("upload_phase") == "finish":
                return httpx.Response(200, json={"success": True})
            return httpx.Response(400, json={"error": {"message": "unexpected"}})

        ref = PageRef(page_id="42", access_token="PAGE-TOKEN")

        async def go():
            client = FacebookClient(graph_base_url="https://graph.facebook.com/v25.0",
                                    app_id="a", app_secret="s",
                                    client=httpx.AsyncClient(
                                        transport=httpx.MockTransport(handler)))
            async with client:
                video_id, url = await client.start_reel(ref)
                await client.upload_reel(ref, upload_url=url, video=b"x" * 1000)
                await client.finish_reel(ref, video_id=video_id, description="hi")
            return video_id

        self.assertEqual(asyncio.run(go()), "v123")
        start, upload, finish = calls
        self.assertTrue(str(start.url).startswith(
            "https://graph.facebook.com/v25.0/42/video_reels"))
        self.assertEqual(upload.headers["authorization"], "OAuth PAGE-TOKEN")
        self.assertEqual(upload.headers["offset"], "0")
        self.assertEqual(upload.headers["file_size"], "1000")
        self.assertEqual(upload.content, b"x" * 1000)
        finish_form = dict(httpx.QueryParams(finish.content.decode()))
        self.assertEqual(finish_form["video_state"], "PUBLISHED")
        self.assertEqual(finish_form["video_id"], "v123")
        # The token is a header, never part of a URL a log could keep.
        for request in calls:
            self.assertNotIn("PAGE-TOKEN", str(request.url))


# ===========================================================================
# A real render
# ===========================================================================
@unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg is not installed")
class Render(unittest.TestCase):
    def test_stills_captions_and_audio_become_a_reel(self) -> None:
        from PIL import Image

        with tempfile.TemporaryDirectory() as tmp:
            work = pathlib.Path(tmp)
            for i, colour in enumerate([(200, 60, 40), (40, 120, 200)]):
                Image.new("RGB", (720, 1280), colour).save(work / f"still-{i:02d}.png")

            narration = work / "narration.wav"
            with wave.open(str(narration), "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(22050)
                w.writeframes(b"\x00\x00" * 22050 * 4)

            cues = captions.cues_for_line("A short test line for the reel",
                                          start=0.0, duration=3.5)
            subs = work / "captions.ass"
            subs.write_text(captions.build_ass(cues, hook_until=2.0), encoding="utf-8")

            scenes = [compose.Scene(seconds=2.0, image=work / "still-00.png"),
                      compose.Scene(seconds=2.0, image=work / "still-01.png")]
            out = asyncio.run(compose.compose(
                ffmpeg="ffmpeg", workdir=work, scenes=scenes,
                narration=narration, subtitles=subs,
            ))

            import subprocess
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries",
                 "stream=codec_name,width,height,sample_rate:format=duration",
                 "-of", "json", str(out)],
                capture_output=True, text=True, check=True,
            )
            info = json.loads(probe.stdout)
            video = [s for s in info["streams"] if s["codec_name"] == "h264"][0]
            audio = [s for s in info["streams"] if s["codec_name"] == "aac"][0]
            self.assertEqual((video["width"], video["height"]), (720, 1280))
            self.assertEqual(audio["sample_rate"], "48000")
            self.assertAlmostEqual(float(info["format"]["duration"]), 4.0, delta=0.2)

    def test_length_outside_meta_limits_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            work = pathlib.Path(tmp)
            for name in ("n.wav", "s.ass", "i.png"):
                (work / name).write_bytes(b"")
            for seconds in (1.0, 120.0):
                with self.subTest(seconds=seconds):
                    with self.assertRaises(compose.ComposeError):
                        asyncio.run(compose.compose(
                            ffmpeg="ffmpeg", workdir=work,
                            scenes=[compose.Scene(seconds=seconds, image=work / "i.png")],
                            narration=work / "n.wav", subtitles=work / "s.ass",
                        ))


if __name__ == "__main__":
    unittest.main(verbosity=2)
