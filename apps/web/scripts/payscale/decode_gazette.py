# -*- coding: utf-8 -*-
"""Decode the National Pay Scale 2026 gazette to a layout-preserving transcript.

    python decode_gazette.py [first_page] [last_page] [--pdf PATH] > transcript.txt

The gazette's Bengali body is set in a subsetted NikoshBAN font whose ToUnicode
CMap covers only punctuation and Latin digits, so ordinary text extraction
produces mojibake. This reads per-glyph IDs from the content streams instead and
maps them through the recovered table in glyphmap.py. See
docs/payscale/GAZETTE-AUDIT.md for how that table was derived and corroborated.

Non-Bengali runs (the SutonnyMJ page headers, Times New Roman English terms) are
passed through bracketed as «Font:text» rather than decoded, because they are
page furniture and legal-English terms, not figures.

Needs PyMuPDF:  pip install pymupdf
"""
import io
import os
import sys

import pymupdf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glyphmap import decode_glyphs  # noqa: E402

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

argv = list(sys.argv[1:])
SRC = os.environ.get('GAZETTE_PDF', os.path.expanduser('~/Desktop/gazet.pdf'))
if '--pdf' in argv:
    i = argv.index('--pdf')
    SRC = argv[i + 1]
    del argv[i:i + 2]
if not os.path.exists(SRC):
    sys.exit('gazette PDF not found: %s  (pass --pdf PATH or set GAZETTE_PDF)' % SRC)

doc = pymupdf.open(SRC)


def page_items(page):
    """(y, x0, x1, text) for every text span on the page."""
    items = []
    for span in page.get_texttrace():
        if not span['chars']:
            continue
        if span['font'] in ('NikoshBAN', 'Nikosh'):
            text = decode_glyphs([c[1] for c in span['chars']])
        else:
            text = ''.join(chr(c[0]) if 32 <= c[0] < 0x2500 else '?' for c in span['chars'])
            text = '«' + span['font'][:4] + ':' + text + '»'
        bbox = span['bbox']
        items.append((round(bbox[1], 1), bbox[0], bbox[2], text))
    return items


def render(page_number):
    """One page as lines, with a column separator where the gap is wide."""
    page = doc[page_number]
    lines = {}
    for y, x0, x1, text in page_items(page):
        lines.setdefault(round(y / 4.0), []).append((x0, x1, text))

    out = []
    for key in sorted(lines):
        buf = ''
        prev_end = None
        for x0, x1, text in sorted(lines[key]):
            if prev_end is not None:
                gap = x0 - prev_end
                if gap > 12:
                    buf += '  |  '
                elif gap > 2.5:
                    buf += ' '
            buf += text
            prev_end = x1
        out.append('%7.1f| %s' % (key * 4.0, buf.rstrip()))
    return '\n'.join(out)


if __name__ == '__main__':
    first = int(argv[0]) if argv else 0
    last = int(argv[1]) if len(argv) > 1 else doc.page_count
    for number in range(first, last):
        print('\n================ PAGE %d ================' % (number + 1))
        print(render(number))
