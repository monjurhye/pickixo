"""From a written script to a finished reel on disk.

    script -> stills (one per scene) -> narration + hook clip (in parallel)
           -> scene timings from the narration -> captions -> ffmpeg

The narration is the clock. Each scene lasts exactly as long as its line takes
to say, so picture, voice and captions cannot drift apart: there is only one
source of timing and everything else is derived from it.

The hook runs alongside the narration because it is the slow step — a queued
video job takes minutes, Piper takes about one — and if it fails the reel opens
on a moving still instead. A failed hook is recorded, never fatal.
"""
from __future__ import annotations

import asyncio
import pathlib
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from ...config import Settings
from ...logging_config import get_logger
from . import captions, compose, hook, tts

log = get_logger(__name__)

#: Appended to every still prompt. The Page's look, in one place.
STYLE = (
    "photorealistic wildlife photography, natural light, sharp focus on the "
    "animal, vertical 9:16 composition with the subject in the upper two "
    "thirds, no text, no watermark, no people"
)
NEGATIVE = "text, watermark, signature, logo, people, humans, cartoon, blurry, deformed"

#: Seconds added after the last line, so the closing question is not cut off
#: the moment it is spoken.
TAIL_SECONDS = 0.8


@dataclass(slots=True, frozen=True)
class Beat:
    line: str
    visual: str


@dataclass(slots=True)
class ReelScript:
    format: str
    topic: str
    animal: str | None
    hook_line: str
    hook_visual: str
    hook_motion: str
    beats: list[Beat]
    question: str
    caption: str
    hashtags: list[str] = field(default_factory=list)

    @property
    def lines(self) -> list[str]:
        """Narration, in scene order: hook, beats, closing question."""
        return [self.hook_line, *(b.line for b in self.beats), self.question]

    @property
    def visuals(self) -> list[str]:
        """One still per distinct picture: the hook, then each beat."""
        return [self.hook_visual, *(b.visual for b in self.beats)]


@dataclass(slots=True)
class ReelResult:
    path: pathlib.Path
    seconds: float
    hook_used: bool
    hook_note: str
    image_providers: list[str]


ImageFn = Callable[..., Awaitable[object]]


async def _generate_stills(script: ReelScript, *, workdir: pathlib.Path,
                           image_fn: ImageFn) -> tuple[list[pathlib.Path], list[bytes], list[str]]:
    """Sequential on purpose: the free image tiers rate-limit bursts."""
    paths: list[pathlib.Path] = []
    blobs: list[bytes] = []
    providers: list[str] = []
    for index, visual in enumerate(script.visuals):
        image = await image_fn(prompt=f"{visual}. {STYLE}", negative_prompt=NEGATIVE,
                               aspect_ratio="9:16")
        path = workdir / f"still-{index:02d}.png"
        path.write_bytes(image.data)
        paths.append(path)
        blobs.append(image.data)
        providers.append(str(getattr(image, "provider", "unknown")))
    return paths, blobs, providers


async def build_reel(script: ReelScript, *, settings: Settings,
                     workdir: pathlib.Path, image_fn: ImageFn) -> ReelResult:
    workdir.mkdir(parents=True, exist_ok=True)

    stills, blobs, providers = await _generate_stills(script, workdir=workdir,
                                                      image_fn=image_fn)

    # --- narration and hook, together ----------------------------------------
    narration_task = tts.narrate(script.lines, model_path=settings.reel_voice_model,
                                 out=workdir / "narration.wav")
    if settings.reel_hook_configured:
        hook_task = hook.generate_hook(
            image=blobs[0], motion_prompt=script.hook_motion,
            fal_key=settings.fal_key, model=settings.reel_hook_model,
            resolution=settings.reel_hook_resolution,
            seconds=settings.reel_hook_seconds,
            timeout_seconds=settings.reel_hook_timeout_seconds,
        )
        narration, hook_outcome = await asyncio.gather(
            narration_task, hook_task, return_exceptions=True
        )
    else:
        narration = await narration_task
        hook_outcome = hook.HookUnavailable("hook disabled (REEL_HOOK_ENABLED / FAL_KEY)")

    if isinstance(narration, BaseException):
        # No voice, no reel: captions and timing both come from it.
        raise narration

    hook_clip: pathlib.Path | None = None
    if isinstance(hook_outcome, bytes):
        hook_clip = workdir / "hook.mp4"
        hook_clip.write_bytes(hook_outcome)
        hook_note = "opened on a Wan clip"
    else:
        hook_note = f"opened on a still: {hook_outcome}"
        if not isinstance(hook_outcome, hook.HookUnavailable):
            log.warning("reel.hook_error", error=f"{type(hook_outcome).__name__}")

    # --- timings -------------------------------------------------------------
    starts = narration.starts
    ends = [*starts[1:], narration.total + TAIL_SECONDS]
    seconds = [end - start for start, end in zip(starts, ends)]

    # Scene pictures: hook (clip or still), each beat's still, and the hook
    # still again under the closing question — a bookend, and one image fewer
    # to pay for.
    scenes: list[compose.Scene] = [
        compose.Scene(seconds=seconds[0], clip=hook_clip,
                      image=None if hook_clip else stills[0]),
    ]
    for index in range(len(script.beats)):
        scenes.append(compose.Scene(seconds=seconds[index + 1], image=stills[index + 1]))
    scenes.append(compose.Scene(seconds=seconds[-1], image=stills[0]))

    # --- captions ------------------------------------------------------------
    cues: list[captions.Cue] = []
    for line, start, duration in zip(script.lines, starts, narration.durations):
        cues.extend(captions.cues_for_line(line, start=start, duration=duration))
    subtitles = workdir / "captions.ass"
    subtitles.write_text(
        captions.build_ass(cues, hook_until=starts[0] + narration.durations[0]),
        encoding="utf-8",
    )

    out = await compose.compose(
        ffmpeg=settings.reel_ffmpeg, workdir=workdir, scenes=scenes,
        narration=narration.path, subtitles=subtitles,
    )
    total = sum(s.seconds for s in scenes)
    log.info("reel.rendered", seconds=round(total, 1), hook=hook_clip is not None,
             bytes=out.stat().st_size)
    return ReelResult(path=out, seconds=total, hook_used=hook_clip is not None,
                      hook_note=hook_note, image_providers=providers)
