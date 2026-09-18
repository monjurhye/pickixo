"""Generate the default social sharing card.

    apps/api/.venv/Scripts/python.exe scripts/make-og-image.py

Writes apps/web/public/og.png at 1200x630, the size Facebook, LinkedIn and X all
render without cropping.

WHY A GENERATED FILE RATHER THAN next/og
----------------------------------------
Next can render this per request from an `opengraph-image.tsx`, which keeps the
card in step with the design tokens automatically. It also crashes on Windows:
@vercel/og calls fileURLToPath on a path it cannot parse there, and the build
fails at prerender. Rather than fight that, the card is generated once and
served as a static file — which on a 4 GB box is the better trade anyway, since
nothing renders an image on demand.

The consequence to know about: change the brand colours and this must be re-run.
That is the price of the static version, and it is written down here so the
next person is not surprised by a stale card.
"""
from __future__ import annotations

import pathlib
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit(
        "Pillow is required. Run this with the API virtualenv:\n"
        "  apps/api/.venv/Scripts/python.exe scripts/make-og-image.py"
    )

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "web" / "public" / "og.png"

W, H = 1200, 630

# Straight from globals.css, converted from the HSL tokens.
CANVAS = (250, 248, 245)
INK = (27, 31, 39)
INK_MUTED = (91, 98, 112)
INK_SUBTLE = (122, 129, 141)
ACCENT = (26, 95, 90)
BORDER = (230, 225, 218)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in (
        f"C:/Windows/Fonts/{name}",
        f"/usr/share/fonts/truetype/dejavu/{name}",
    ):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    img = Image.new("RGB", (W, H), CANVAS)
    d = ImageDraw.Draw(img)

    bold = font("arialbd.ttf", 64)
    regular = font("arial.ttf", 34)
    small = font("arial.ttf", 26)
    wordmark = font("arialbd.ttf", 46)

    pad = 80

    # --- mark + wordmark ----------------------------------------------------
    mark = 72
    d.rounded_rectangle([pad, pad, pad + mark, pad + mark], radius=18, fill=ACCENT)
    # The same pointer as components/Logo.tsx, scaled from its 32px viewBox.
    s = mark / 32
    d.polygon(
        [
            (pad + 11 * s, pad + 8.5 * s),
            (pad + 23 * s, pad + 15.4 * s),
            (pad + 17.6 * s, pad + 17.2 * s),
            (pad + 15.1 * s, pad + 22.6 * s),
        ],
        fill=(255, 255, 255),
    )
    d.text((pad + mark + 24, pad + 12), "Pickixo", font=wordmark, fill=INK)

    # --- headline -----------------------------------------------------------
    lines = ["AI, Apps, Tools, Games,", "Jobs & Education"]
    y = 270
    for line in lines:
        d.text((pad, y), line, font=bold, fill=INK)
        y += 78

    d.text(
        (pad, y + 18),
        "All in one place. One account. Free to use.",
        font=regular,
        fill=INK_MUTED,
    )

    # --- footer -------------------------------------------------------------
    rule_y = H - 110
    d.line([(pad, rule_y), (W - pad, rule_y)], fill=BORDER, width=2)
    d.text((pad, rule_y + 30), "pickixo.com", font=small, fill=INK_SUBTLE)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size:,} bytes, {W}x{H})")


if __name__ == "__main__":
    main()
