"""US units first, metric alongside — enforced, not requested.

The prompts ask for "2,500 miles (4,000 km)", and the model mostly complies,
but the first reel this Page published said "2,500 miles" and stopped. A
conversion is arithmetic, not judgement, so it is done here: any US measurement
in written text that is not already followed by a parenthesis gets its metric
value added.

Only written text (captions, comment replies). Narrated lines are spoken, and
"(4,000 km)" read aloud is noise; the prompt asks for the metric in words there.

Values are rounded to two significant figures, because the US figure is itself
usually a rounded, hedged value ("about 2,500 miles"), and "4,023 km" next to it
would claim a precision nobody has.
"""
from __future__ import annotations

import math
import re

_NUMBER = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?"

#: unit pattern -> (metric unit, conversion). Longer spellings first, so that
#: "miles per hour" is not read as "miles".
_UNITS: list[tuple[str, str, object]] = [
    (r"miles? (?:per|an) hour|mph", "km/h", 1.609344),
    (r"square miles?", "km²", 2.589988),
    (r"miles?|mi", "km", 1.609344),
    (r"pounds?|lbs?", "kg", 0.45359237),
    (r"ounces?|oz", "g", 28.349523),
    (r"tons?", "metric tons", 0.90718474),
    (r"feet|foot|ft", "m", 0.3048),
    # Not "in": "5 in the morning" is not a length.
    (r"inches|inch", "cm", 2.54),
    (r"yards?|yd", "m", 0.9144),
    (r"gallons?", "L", 3.785412),
    (r"°\s?F|degrees Fahrenheit", "°C", "F"),
]

_PATTERN = re.compile(
    rf"(?P<low>{_NUMBER})(?:\s*(?:-|–|to)\s*(?P<high>{_NUMBER}))?"
    rf"(?:-|\s*)(?P<unit>{'|'.join(f'(?:{u})' for u, _, _ in _UNITS)})"
    r"(?![A-Za-z])(?P<after>\s*\()?",
    re.IGNORECASE,
)


def _round(value: float) -> str:
    if value == 0:
        return "0"
    if abs(value) < 10:
        text = f"{value:.1f}".rstrip("0").rstrip(".")
        return text
    digits = int(math.floor(math.log10(abs(value)))) - 1
    rounded = round(value, -digits)
    return f"{int(rounded):,}"


def _convert(value: str, factor: object) -> str:
    number = float(value.replace(",", ""))
    if factor == "F":
        return str(round((number - 32) * 5 / 9))
    return _round(number * float(factor))  # type: ignore[arg-type]


def add_metric(text: str) -> str:
    """Return `text` with a metric value after each US measurement lacking one."""
    if not text:
        return text

    def replace(match: re.Match) -> str:
        if match.group("after"):
            return match.group(0)  # already has a parenthesis after it
        unit_text = match.group("unit")
        for pattern, metric, factor in _UNITS:
            if re.fullmatch(pattern, unit_text, re.IGNORECASE):
                break
        else:  # pragma: no cover - the alternation only matches listed units
            return match.group(0)
        low = _convert(match.group("low"), factor)
        high = match.group("high")
        value = f"{low}-{_convert(high, factor)}" if high else low
        separator = "" if metric.startswith("°") else " "
        return f"{match.group(0)} ({value}{separator}{metric})"

    return _PATTERN.sub(replace, text)
