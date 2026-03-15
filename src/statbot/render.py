from __future__ import annotations

from typing import Iterable

import pandas as pd

SPARKS = "▁▂▃▄▅▆▇█"
MONTH_LABELS = {1: "Jän", 2: "Feb", 3: "Mär", 4: "Apr", 5: "Mai", 6: "Jun", 7: "Jul", 8: "Aug", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Dez"}


def sparkline(values: Iterable[float | int]) -> str:
    vals = list(values)
    if not vals:
        return ""
    lo, hi = min(vals), max(vals)
    if lo == hi:
        return SPARKS[0] * len(vals)
    out = []
    for value in vals:
        idx = round((value - lo) / (hi - lo) * (len(SPARKS) - 1))
        out.append(SPARKS[idx])
    return "".join(out)


def format_table(df: pd.DataFrame, max_rows: int = 10) -> str:
    if df.empty:
        return "(keine Zeilen)"
    clipped = df.head(max_rows).copy()
    return clipped.to_string(index=False)


def month_label(value: int) -> str:
    return MONTH_LABELS.get(value, str(value))
