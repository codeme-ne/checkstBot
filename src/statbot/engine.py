from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .catalog import TOURISM_BY_ACCOMMODATION
from .fetch import DataFetcher
from .parser import QueryParser, UserQuery
from .render import format_table, month_label, sparkline


@dataclass
class EngineResponse:
    headline: str
    body: str
    table: str | None
    chart: str | None
    source: str
    query: UserQuery


class StatisticsChatbotEngine:
    def __init__(self, refresh: bool = False, cache_dir: str = ".cache") -> None:
        self.spec = TOURISM_BY_ACCOMMODATION
        self.fetcher = DataFetcher(self.spec, cache_dir=cache_dir)
        self.parser = QueryParser()
        self.df = self.fetcher.load_enriched_dataframe(refresh=refresh)

    def answer(self, question: str) -> EngineResponse:
        query = self.parser.parse(question)
        if query.metric is None:
            return self._clarify_metric(query)

        if query.query_type == "ranking_accommodation":
            return self._ranking_accommodation(query)
        if query.query_type == "compare_states":
            return self._compare_states(query)
        if query.query_type == "trend":
            return self._trend(query)
        return self._value(query)

    def _source_text(self) -> str:
        return (
            "Quelle: Statistik Austria Open Data – Nächtigungsstatistik nach Unterkunftsarten und Bundesländern "
            "(data.statistik.gv.at)."
        )

    def _metric_col(self, query: UserQuery) -> str:
        return self.spec.metrics[query.metric or "naechtigungen"]

    def _metric_label(self, query: UserQuery) -> str:
        return "Ankünfte" if query.metric == "ankuenfte" else "Nächtigungen"

    def _apply_common_filters(self, query: UserQuery) -> pd.DataFrame:
        data = self.df.copy()
        if query.year is not None:
            data = data[data["year"] == query.year]
        if query.month is not None:
            data = data[data["month"] == query.month]
        if query.states:
            data = data[data["state_name"].apply(lambda s: any(s.startswith(st) for st in query.states))]
        return data

    def _clarify_metric(self, query: UserQuery) -> EngineResponse:
        return EngineResponse(
            headline="Rückfrage nötig",
            body="Bitte präzisieren Sie die Kennzahl: Meinen Sie Ankünfte oder Nächtigungen?",
            table=None,
            chart=None,
            source=self._source_text(),
            query=query,
        )

    def _value(self, query: UserQuery) -> EngineResponse:
        if query.year is None and query.month is None:
            return EngineResponse(
                headline="Rückfrage nötig",
                body="Bitte geben Sie mindestens einen Zeitraum an, z. B. Jahr 2025 oder Jänner 2026.",
                table=None,
                chart=None,
                source=self._source_text(),
                query=query,
            )

        data = self._apply_common_filters(query)
        metric = self._metric_col(query)
        value = int(data[metric].sum())
        geo = query.states[0] if len(query.states) == 1 else "Österreich"
        period = self._period_label(query)
        body = f"{self._metric_label(query)} in {geo} für {period}: {value:,}.".replace(",", ".")
        return EngineResponse(
            headline="Wertabfrage",
            body=body,
            table=None,
            chart=None,
            source=self._source_text(),
            query=query,
        )

    def _compare_states(self, query: UserQuery) -> EngineResponse:
        if len(query.states) < 2:
            return EngineResponse(
                headline="Rückfrage nötig",
                body="Für einen Vergleich brauche ich mindestens zwei Bundesländer.",
                table=None,
                chart=None,
                source=self._source_text(),
                query=query,
            )
        if query.year is None and query.month is None:
            return EngineResponse(
                headline="Rückfrage nötig",
                body="Für einen Vergleich brauche ich einen Zeitraum, z. B. 2025 oder Jänner 2026.",
                table=None,
                chart=None,
                source=self._source_text(),
                query=query,
            )

        data = self._apply_common_filters(query)
        metric = self._metric_col(query)
        grouped = (
            data.groupby("state_name", as_index=False)[metric]
            .sum()
            .rename(columns={metric: self._metric_label(query)})
            .sort_values(self._metric_label(query), ascending=False)
        )
        grouped["state_name"] = grouped["state_name"].str.replace(r"\s*<.*>$", "", regex=True)
        body = f"Vergleich {self._metric_label(query)} für {self._period_label(query)}."
        return EngineResponse(
            headline="Bundesländervergleich",
            body=body,
            table=format_table(grouped),
            chart=None,
            source=self._source_text(),
            query=query,
        )

    def _ranking_accommodation(self, query: UserQuery) -> EngineResponse:
        if query.year is None and query.month is None:
            return EngineResponse(
                headline="Rückfrage nötig",
                body="Für ein Ranking brauche ich einen Zeitraum, z. B. 2025 oder Jänner 2026.",
                table=None,
                chart=None,
                source=self._source_text(),
                query=query,
            )
        data = self._apply_common_filters(query)
        metric = self._metric_col(query)
        grouped = (
            data.groupby("accommodation_name", as_index=False)[metric]
            .sum()
            .rename(columns={metric: self._metric_label(query), "accommodation_name": "Unterkunftsart"})
            .sort_values(self._metric_label(query), ascending=False)
        )
        if query.limit:
            grouped = grouped.head(query.limit)
        else:
            grouped = grouped.head(10)

        geo = query.states[0] if len(query.states) == 1 else "Österreich"
        body = f"Top-Unterkunftsarten nach {self._metric_label(query)} in {geo} für {self._period_label(query)}."
        return EngineResponse(
            headline="Ranking Unterkunftsarten",
            body=body,
            table=format_table(grouped, max_rows=len(grouped)),
            chart=None,
            source=self._source_text(),
            query=query,
        )

    def _trend(self, query: UserQuery) -> EngineResponse:
        metric = self._metric_col(query)
        data = self.df.copy()
        if query.states:
            data = data[data["state_name"].apply(lambda s: any(s.startswith(st) for st in query.states))]

        if query.start_year is not None:
            data = data[data["year"] >= query.start_year]
        elif query.year is not None:
            data = data[data["year"] == query.year]

        # Unvollständiges laufendes Jahr bei Jahres-Trends standardmäßig ausblenden,
        # solange die Nutzerfrage dieses Jahr nicht explizit verlangt.
        if query.start_year is not None and query.year is None and not data.empty:
            latest_year = int(data["year"].max())
            month_count = int(data.loc[data["year"] == latest_year, "month"].nunique())
            if month_count < 12:
                data = data[data["year"] < latest_year]

        by_month = query.year is not None and any(word in query.raw_text.lower() for word in ["monat", "monatlich", "pro monat"])
        if by_month:
            grouped = data.groupby("month", as_index=False)[metric].sum()
            grouped["Label"] = grouped["month"].apply(month_label)
        else:
            grouped = data.groupby("year", as_index=False)[metric].sum()
            grouped["Label"] = grouped["year"].astype(str)

        label_col = "Label"
        value_label = self._metric_label(query)
        grouped = grouped.rename(columns={metric: value_label})
        chart = f"{sparkline(grouped[value_label].tolist())}  " + " ".join(grouped[label_col].tolist())
        geo = query.states[0] if len(query.states) == 1 else "Österreich"
        period = f"seit {query.start_year}" if query.start_year else (str(query.year) if query.year else "verfügbarem Zeitraum")
        body = f"Trend {self._metric_label(query)} in {geo} für {period}."
        return EngineResponse(
            headline="Trendanalyse",
            body=body,
            table=format_table(grouped[[label_col, value_label]].rename(columns={label_col: "Periode"}), max_rows=len(grouped)),
            chart=chart,
            source=self._source_text(),
            query=query,
        )

    def _period_label(self, query: UserQuery) -> str:
        if query.month and query.year:
            return f"{month_label(query.month)} {query.year}"
        if query.year:
            return str(query.year)
        return "aktuellen Zeitraum"
