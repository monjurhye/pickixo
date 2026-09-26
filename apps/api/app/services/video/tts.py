"""Narration with Piper — offline, free, on this machine.

One call per line rather than one for the whole script. That is what makes the
captions exact: each line's duration is read from its own audio, so the caption
for a line starts when the line starts, with no speech recognition needed to
find out.

Piper runs on the CPU at roughly half real time here (a 30-second script takes
about a minute), which is fine for a worker that posts twice a day and would be
a problem anywhere a person waits on it.
"""
from __future__ import annotations

import asyncio
import pathlib
import threading
import wave
from dataclasses import dataclass

from ...logging_config import get_logger

log = get_logger(__name__)

_voice_lock = threading.Lock()
_voices: dict[str, object] = {}


class NarrationUnavailable(RuntimeError):
    """The voice model is missing or Piper is not installed."""


@dataclass(slots=True, frozen=True)
class Narration:
    path: pathlib.Path
    #: Seconds of speech in each line, in order, not counting the gaps.
    durations: list[float]
    #: When each line starts in the combined track.
    starts: list[float]
    total: float


def _load_voice(model_path: str):
    """Load once per process. The model is 120 MB and takes seconds to load."""
    with _voice_lock:
        voice = _voices.get(model_path)
        if voice is not None:
            return voice
        path = pathlib.Path(model_path)
        if not path.is_file():
            raise NarrationUnavailable(
                f"voice model not found at {path} — see docs/FACEBOOK_SETUP.md "
                "(Reels) for the one-line download"
            )
        try:
            from piper import PiperVoice
        except ImportError as exc:  # pragma: no cover - dependency missing
            raise NarrationUnavailable("piper-tts is not installed") from exc
        voice = PiperVoice.load(str(path))
        _voices[model_path] = voice
        return voice


def _synthesise(model_path: str, lines: list[str], out: pathlib.Path,
                gap_seconds: float) -> Narration:
    voice = _load_voice(model_path)

    frames: list[bytes] = []
    durations: list[float] = []
    starts: list[float] = []
    params = None
    cursor = 0.0

    for index, line in enumerate(lines):
        part = out.with_name(f"{out.stem}-{index:02d}.wav")
        with wave.open(str(part), "wb") as w:
            voice.synthesize_wav(line, w)
        with wave.open(str(part), "rb") as r:
            if params is None:
                params = r.getparams()
            data = r.readframes(r.getnframes())
            seconds = r.getnframes() / r.getframerate()
        part.unlink(missing_ok=True)

        starts.append(cursor)
        durations.append(seconds)
        frames.append(data)
        # Silence between lines: a beat to read the caption, and the gap the
        # caption timing relies on.
        silence = int(params.framerate * gap_seconds) * params.sampwidth * params.nchannels
        frames.append(b"\x00" * silence)
        cursor += seconds + gap_seconds

    if params is None:
        raise NarrationUnavailable("nothing to narrate")

    with wave.open(str(out), "wb") as w:
        w.setnchannels(params.nchannels)
        w.setsampwidth(params.sampwidth)
        w.setframerate(params.framerate)
        for chunk in frames:
            w.writeframes(chunk)

    return Narration(path=out, durations=durations, starts=starts, total=cursor)


async def narrate(lines: list[str], *, model_path: str, out: pathlib.Path,
                  gap_seconds: float = 0.35) -> Narration:
    """Synthesise every line into one WAV, and report where each line sits.

    Lines map one-to-one onto scenes, so an empty line is refused rather than
    skipped: skipping it would shift every later caption onto the wrong image.
    """
    clean = [" ".join((line or "").split()) for line in lines]
    if not clean or not all(clean):
        raise NarrationUnavailable("every scene needs a narration line")
    return await asyncio.to_thread(_synthesise, model_path, clean, out, gap_seconds)
