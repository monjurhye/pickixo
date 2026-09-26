"""ffmpeg: turn stills, an optional hook clip, narration and captions into a reel.

Three passes, each simple enough to debug from its command line alone:

1. one silent segment per scene, exactly as long as that scene's narration —
   a still with a slow zoom or pan, or the hook clip trimmed (or held on its
   last frame) to fit;
2. concat of those segments, which share codec parameters by construction;
3. captions burned in and the narration muxed, in the final encode.

Output follows Meta's Reels spec: 9:16, H.264 + AAC 48 kHz, 30 fps, 3–90 s.
720x1280 rather than 1080x1920 because that is what the stills are generated
at; upscaling adds bytes, not detail.

Every ffmpeg call runs with cwd set to the work directory and refers to files
by bare name. The `ass` filter's argument is parsed by ffmpeg's filter-graph
syntax, where a Windows path's drive colon is a separator — a relative name
sidesteps the escaping entirely.
"""
from __future__ import annotations

import asyncio
import pathlib
import subprocess
from dataclasses import dataclass

from ...logging_config import get_logger

log = get_logger(__name__)

WIDTH, HEIGHT = 720, 1280
FPS = 30
MIN_SECONDS, MAX_SECONDS = 3.0, 90.0

#: Camera moves for stills, cycled so consecutive scenes do not all zoom in.
#: `on` is the output frame number, `{n}` the scene's frame count.
MOTIONS = {
    "zoom_in": ("1+0.12*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"),
    "pan_right": ("1.12", "(iw-iw/zoom)*on/{n}", "ih/2-(ih/zoom/2)"),
    "zoom_out": ("1.12-0.12*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"),
    "pan_up": ("1.12", "iw/2-(iw/zoom/2)", "(ih-ih/zoom)*(1-on/{n})"),
}
MOTION_ORDER = ("zoom_in", "pan_right", "zoom_out", "pan_up")


class ComposeError(RuntimeError):
    """ffmpeg failed. Carries the tail of its stderr."""


@dataclass(slots=True, frozen=True)
class Scene:
    """One stretch of the reel: what is on screen, for how long."""
    seconds: float
    image: pathlib.Path | None = None
    clip: pathlib.Path | None = None


def _run(ffmpeg: str, args: list[str], cwd: pathlib.Path) -> None:
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", *args]
    completed = subprocess.run(
        command, cwd=str(cwd), capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=600,
    )
    if completed.returncode != 0:
        tail = (completed.stderr or "").strip()[-800:]
        raise ComposeError(f"ffmpeg exited {completed.returncode}: {tail}")


def still_args(image: str, out: str, seconds: float, motion: str) -> list[str]:
    """A still with a camera move. Upscaled 2x first: zoompan on a frame the
    size of the output steps by whole pixels and visibly judders."""
    frames = max(1, round(seconds * FPS))
    z, x, y = (part.format(n=frames) for part in MOTIONS[motion])
    vf = (
        f"scale={WIDTH * 2}:{HEIGHT * 2}:force_original_aspect_ratio=increase,"
        f"crop={WIDTH * 2}:{HEIGHT * 2},"
        f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={WIDTH}x{HEIGHT}:fps={FPS},"
        "format=yuv420p"
    )
    return ["-i", image, "-vf", vf, "-frames:v", str(frames),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
            "-r", str(FPS), "-an", out]


def clip_args(clip: str, out: str, seconds: float) -> list[str]:
    """The hook clip, fitted to the frame and to its scene's length.

    tpad holds the last frame if the narration outlasts the clip; trim cuts it
    if the clip outlasts the narration. Either way the segment is exactly
    `seconds` long, which is what keeps captions and audio in step.
    """
    vf = (
        f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,"
        f"crop={WIDTH}:{HEIGHT},fps={FPS},"
        f"tpad=stop_mode=clone:stop_duration={seconds + 1:.2f},"
        f"trim=duration={seconds:.3f},setpts=PTS-STARTPTS,format=yuv420p"
    )
    return ["-i", clip, "-vf", vf, "-c:v", "libx264", "-preset", "veryfast",
            "-crf", "18", "-r", str(FPS), "-an", out]


def final_args(concat_list: str, narration: str, subtitles: str, out: str) -> list[str]:
    return [
        "-f", "concat", "-safe", "0", "-i", concat_list,
        "-i", narration,
        "-vf", f"ass={subtitles}",
        "-af", "apad",
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "medium", "-crf", "21",
        "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        "-shortest", "-movflags", "+faststart", out,
    ]


def _compose(ffmpeg: str, workdir: pathlib.Path, scenes: list[Scene],
             narration: pathlib.Path, subtitles: pathlib.Path,
             out_name: str) -> pathlib.Path:
    segment_names: list[str] = []
    still_index = 0
    for index, scene in enumerate(scenes):
        name = f"seg-{index:02d}.mp4"
        if scene.clip is not None:
            _run(ffmpeg, clip_args(scene.clip.name, name, scene.seconds), workdir)
        elif scene.image is not None:
            motion = MOTION_ORDER[still_index % len(MOTION_ORDER)]
            still_index += 1
            _run(ffmpeg, still_args(scene.image.name, name, scene.seconds, motion),
                 workdir)
        else:
            raise ComposeError(f"scene {index} has neither an image nor a clip")
        segment_names.append(name)

    (workdir / "segments.txt").write_text(
        "".join(f"file '{n}'\n" for n in segment_names), encoding="utf-8"
    )
    _run(ffmpeg, final_args("segments.txt", narration.name, subtitles.name, out_name),
         workdir)

    out = workdir / out_name
    if not out.is_file() or out.stat().st_size == 0:
        raise ComposeError("ffmpeg reported success but wrote no file")
    return out


async def compose(*, ffmpeg: str, workdir: pathlib.Path, scenes: list[Scene],
                  narration: pathlib.Path, subtitles: pathlib.Path,
                  out_name: str = "reel.mp4") -> pathlib.Path:
    """Render the reel. Every input must already be inside `workdir`."""
    total = sum(s.seconds for s in scenes)
    if not MIN_SECONDS <= total <= MAX_SECONDS:
        raise ComposeError(
            f"a reel must run {MIN_SECONDS:.0f}-{MAX_SECONDS:.0f}s; this one is {total:.1f}s"
        )
    for path in [narration, subtitles, *(s.image for s in scenes if s.image),
                 *(s.clip for s in scenes if s.clip)]:
        if path.parent.resolve() != workdir.resolve():
            raise ComposeError(f"{path.name} is not in the work directory")

    return await asyncio.to_thread(_compose, ffmpeg, workdir, scenes,
                                   narration, subtitles, out_name)
