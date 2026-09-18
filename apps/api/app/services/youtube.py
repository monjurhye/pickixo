"""Turning whatever a user pasted into a YouTube video id, or refusing to.

This runs before anything is sent to the provider, and that ordering is the
point: the provider charges per successful call and is a third party we hand
input to. Nothing reaches it that has not first been proved to be a YouTube
video id.

A video id is exactly 11 characters of [A-Za-z0-9_-]. That is not a guess — it
is the shape YouTube has used throughout, and checking it means a malformed or
hostile URL is rejected here rather than becoming someone else's problem.
"""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

#: YouTube ids are 11 characters of base64url. Anchored, so a longer string
#: containing a valid-looking id does not slip through.
VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

#: Hosts we will accept a video id from. An allowlist rather than "contains
#: youtube", which would happily accept youtube.com.evil.example.
ALLOWED_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com",
    "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com",
    "youtu.be", "www.youtu.be",
}

#: Path prefixes that carry the id as the next segment.
PATH_PREFIXES = ("shorts", "embed", "v", "live")

MAX_INPUT_LENGTH = 2048


class InvalidYouTubeUrl(ValueError):
    """The input is not something we can identify as a YouTube video."""


def extract_video_id(raw: str) -> str:
    """Return the 11-character video id, or raise InvalidYouTubeUrl.

    Accepts:
        https://www.youtube.com/watch?v=ID
        https://youtu.be/ID
        https://www.youtube.com/shorts/ID
        https://www.youtube.com/embed/ID
        https://www.youtube.com/live/ID
        youtube.com/watch?v=ID          (no scheme)
        ID                              (a bare id)

    Rejects everything else, including other people's URLs.
    """
    if raw is None:
        raise InvalidYouTubeUrl("no input")

    value = raw.strip()
    if not value:
        raise InvalidYouTubeUrl("empty input")
    if len(value) > MAX_INPUT_LENGTH:
        raise InvalidYouTubeUrl("input too long")

    # A bare id, which is what the cache and the provider both actually want.
    if VIDEO_ID_RE.match(value):
        return value

    # urlparse puts everything in `path` when there is no scheme, so give it one.
    candidate = value if "://" in value else f"https://{value}"
    try:
        parsed = urlparse(candidate)
    except ValueError as exc:
        raise InvalidYouTubeUrl("unparseable url") from exc

    if parsed.scheme not in ("http", "https"):
        raise InvalidYouTubeUrl(f"unsupported scheme {parsed.scheme!r}")

    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        raise InvalidYouTubeUrl(f"not a youtube host: {host!r}")

    # youtu.be/ID — the id is the whole path.
    if host.endswith("youtu.be"):
        segment = parsed.path.strip("/").split("/")[0]
        return _validated(segment)

    segments = [s for s in parsed.path.split("/") if s]

    # /watch?v=ID
    if segments and segments[0] == "watch":
        values = parse_qs(parsed.query).get("v", [])
        if not values:
            raise InvalidYouTubeUrl("watch url without a v parameter")
        return _validated(values[0])

    # /shorts/ID, /embed/ID, /v/ID, /live/ID
    if len(segments) >= 2 and segments[0] in PATH_PREFIXES:
        return _validated(segments[1])

    # Some share links carry ?v= on an unexpected path.
    values = parse_qs(parsed.query).get("v", [])
    if values:
        return _validated(values[0])

    raise InvalidYouTubeUrl("no video id in url")


def _validated(candidate: str) -> str:
    # Trailing junk is common in pasted links: ?si=..., &t=30, #fragment.
    # urlparse strips query and fragment, but youtu.be paths can still carry a
    # stray segment, so the shape is checked rather than assumed.
    candidate = candidate.strip()
    if not VIDEO_ID_RE.match(candidate):
        raise InvalidYouTubeUrl(f"not a valid video id: {candidate[:32]!r}")
    return candidate


def canonical_url(video_id: str) -> str:
    """The one URL we store, whatever shape the user pasted."""
    return f"https://www.youtube.com/watch?v={video_id}"
