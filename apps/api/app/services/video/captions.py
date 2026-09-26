"""Burned-in captions, as an ASS subtitle script.

Most people watch reels with the sound off, so the words are on screen or they
are not delivered at all. Two decisions follow from that:

* Short chunks — three to five words — rather than whole sentences. A sentence
  at reel size is a paragraph, and nobody reads a paragraph while scrolling.
* Timing comes from the narration itself. Each line is synthesised separately,
  so its exact duration is known, and the chunks within it are spread by
  character count. No speech recognition, and nothing to drift.

ASS rather than SRT because the style lives in the file: libass renders it the
same way on every machine, and ffmpeg needs no force_style string to escape.
"""
from __future__ import annotations

from dataclasses import dataclass

#: Width and height of the output. ASS positions are in these units.
PLAY_RES = (720, 1280)

#: Chunks aim for this many words and never exceed MAX_WORDS.
TARGET_WORDS = 4
MAX_WORDS = 5


@dataclass(slots=True, frozen=True)
class Cue:
    start: float
    end: float
    text: str


def chunk_words(line: str, *, target: int = TARGET_WORDS,
                maximum: int = MAX_WORDS) -> list[str]:
    """Split a line into caption-sized pieces.

    Prefers to break after punctuation, so "Owls can't move their eyes, so they
    turn their heads" breaks at the comma rather than mid-phrase.
    """
    words = line.split()
    if not words:
        return []

    chunks: list[str] = []
    current: list[str] = []
    for word in words:
        current.append(word)
        # A sentence end always closes a caption — "wins. Over distance" on
        # one card reads as one thought. A comma closes it only once there is
        # enough on the card to be worth showing alone.
        at_stop = word[-1] in ".!?"
        at_pause = word[-1] in ",;:—"
        if (len(current) >= maximum
                or (len(current) >= 2 and at_stop)
                or (len(current) >= target - 1 and at_pause)):
            chunks.append(" ".join(current))
            current = []
    if current:
        # A dangling single word reads as a glitch. Fold it into the previous
        # chunk if that has room; if not, borrow that chunk's last word so the
        # final caption is a pair.
        if len(current) == 1 and chunks:
            previous = chunks[-1].split()
            if len(previous) < maximum:
                chunks[-1] = " ".join([*previous, current[0]])
            else:
                chunks[-1] = " ".join(previous[:-1])
                chunks.append(" ".join([previous[-1], current[0]]))
        else:
            chunks.append(" ".join(current))
    return chunks


def cues_for_line(line: str, *, start: float, duration: float) -> list[Cue]:
    """Spread a line's chunks across the time its narration takes."""
    chunks = chunk_words(line)
    if not chunks or duration <= 0:
        return []

    total_chars = sum(len(c) for c in chunks)
    cues: list[Cue] = []
    t = start
    for i, chunk in enumerate(chunks):
        share = duration * len(chunk) / total_chars
        end = start + duration if i == len(chunks) - 1 else t + share
        cues.append(Cue(start=t, end=end, text=chunk))
        t = end
    return cues


def _timestamp(seconds: float) -> str:
    """ASS time: H:MM:SS.cc (centiseconds)."""
    centis = max(0, int(round(seconds * 100)))
    h, rem = divmod(centis, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _escape(text: str) -> str:
    """Neutralise ASS override syntax in model-written text.

    Braces start override blocks and a backslash starts a tag. Narration comes
    from a language model, and a stray "{\\pos(0,0)}" in it must render as
    text, not move the caption off screen.
    """
    return (text.replace("\\", "⧵")
                .replace("{", "(").replace("}", ")")
                .replace("\n", " "))


def build_ass(cues: list[Cue], *, hook_until: float = 0.0) -> str:
    """The full subtitle script.

    Two styles: the hook line is larger and yellow, because it is the promise
    the rest of the reel keeps; everything after is white. `hook_until` is when
    the hook line's narration ends — cues starting before it get the hook style.
    """
    width, height = PLAY_RES
    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n"
        "WrapStyle: 0\n"
        "ScaledBorderAndShadow: yes\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, "
        "ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, "
        "MarginL, MarginR, MarginV, Encoding\n"
        # Alignment 2 = bottom centre; MarginV lifts it clear of Facebook's own
        # caption and button overlay at the bottom of the reel viewer.
        "Style: Body,Arial,58,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,"
        "-1,0,0,0,100,100,0,0,1,5,2,2,60,60,420,1\n"
        "Style: Hook,Arial,66,&H0000E5FF,&H0000E5FF,&H00000000,&H64000000,"
        "-1,0,0,0,100,100,0,0,1,6,2,2,60,60,420,1\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, "
        "Effect, Text\n"
    )
    lines = []
    for cue in cues:
        style = "Hook" if cue.start < hook_until else "Body"
        lines.append(
            f"Dialogue: 0,{_timestamp(cue.start)},{_timestamp(cue.end)},"
            f"{style},,0,0,0,,{_escape(cue.text)}"
        )
    return header + "\n".join(lines) + "\n"
