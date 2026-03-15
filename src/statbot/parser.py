from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


MONTHS = {
    "jaenner": 1,
    "janner": 1,
    "jänner": 1,
    "januar": 1,
    "jan": 1,
    "februar": 2,
    "feb": 2,
    "maerz": 3,
    "marz": 3,
    "märz": 3,
    "maer": 3,
    "mrz": 3,
    "april": 4,
    "apr": 4,
    "mai": 5,
    "juni": 6,
    "jun": 6,
    "juli": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "oktober": 10,
    "okt": 10,
    "november": 11,
    "nov": 11,
    "dezember": 12,
    "dez": 12,
}

STATE_ALIASES = {
    "burgenland": "Burgenland",
    "kaernten": "Kärnten",
    "kärnten": "Kärnten",
    "niederoesterreich": "Niederösterreich",
    "niederösterreich": "Niederösterreich",
    "oberoesterreich": "Oberösterreich",
    "oberösterreich": "Oberösterreich",
    "salzburg": "Salzburg",
    "steiermark": "Steiermark",
    "tirol": "Tirol",
    "vorarlberg": "Vorarlberg",
    "wien": "Wien",
    "vienna": "Wien",
}


@dataclass
class UserQuery:
    raw_text: str
    metric: str | None
    query_type: str
    states: list[str]
    year: int | None
    month: int | None
    start_year: int | None
    group_by: str | None
    limit: int | None = None


class QueryParser:
    def __init__(self) -> None:
        pass

    @staticmethod
    def _normalize(text: str) -> str:
        normalized = unicodedata.normalize("NFKD", text.lower())
        normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
        return normalized

    def parse(self, text: str) -> UserQuery:
        norm = self._normalize(text)
        metric = self._detect_metric(norm)
        states = self._detect_states(norm)
        year, month, start_year = self._detect_time(norm)
        query_type = self._detect_query_type(norm, states)
        group_by = None
        limit = self._detect_limit(norm)

        if query_type == "ranking_accommodation":
            group_by = "accommodation"
            if metric is None:
                metric = "naechtigungen"

        if query_type == "compare_states" and len(states) < 2:
            query_type = "value"

        return UserQuery(
            raw_text=text,
            metric=metric,
            query_type=query_type,
            states=states,
            year=year,
            month=month,
            start_year=start_year,
            group_by=group_by,
            limit=limit,
        )

    def _detect_metric(self, norm: str) -> str | None:
        if any(token in norm for token in ["ankunft", "ankuenft"]):
            return "ankuenfte"
        if any(token in norm for token in ["naechtig", "nachtigung", "ubernachtung", "übernachtung"]):
            return "naechtigungen"
        return None

    def _detect_states(self, norm: str) -> list[str]:
        found: list[str] = []
        for alias, canonical in STATE_ALIASES.items():
            if re.search(rf"\b{re.escape(alias)}\b", norm) and canonical not in found:
                found.append(canonical)
        return found

    def _detect_time(self, norm: str) -> tuple[int | None, int | None, int | None]:
        years = [int(y) for y in re.findall(r"\b(19\d{2}|20\d{2})\b", norm)]
        month = None
        for token, value in MONTHS.items():
            if re.search(rf"\b{re.escape(token)}\b", norm):
                month = value
                break
        start_year = None
        if "seit" in norm and years:
            start_year = years[0]
        year = years[-1] if years else None
        if start_year is not None and len(years) == 1:
            year = None
        return year, month, start_year

    def _detect_limit(self, norm: str) -> int | None:
        match = re.search(r"\btop\s*(\d+)\b", norm)
        if match:
            return int(match.group(1))
        return None

    def _detect_query_type(self, norm: str, states: list[str]) -> str:
        if (
            "unterkunft" in norm
            or "unterkunftsart" in norm
            or "beherbergungsbetrieb" in norm
        ) and any(word in norm for word in ["welche", "meisten", "top", "rang", "haeufigsten", "häufigsten"]):
            return "ranking_accommodation"
        if len(states) >= 2 or any(word in norm for word in ["vergleich", "vergleiche", "vs", "gegenüber"]):
            return "compare_states"
        if any(word in norm for word in ["entwicklung", "trend", "verlauf", "seit", "monatlich", "pro monat"]):
            return "trend"
        return "value"
