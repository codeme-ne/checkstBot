import pandas as pd

from statbot.catalog import TOURISM_BY_ACCOMMODATION
from statbot.engine import StatisticsChatbotEngine
from statbot.parser import QueryParser


def make_engine() -> StatisticsChatbotEngine:
    engine = StatisticsChatbotEngine.__new__(StatisticsChatbotEngine)
    engine.spec = TOURISM_BY_ACCOMMODATION
    engine.parser = QueryParser()
    engine.df = pd.DataFrame(
        [
            {"year": 2025, "month": 1, "state_name": "Tirol <AT33>", "accommodation_name": "Hotel A", "F-ANK": 10, "F-UEB": 100},
            {"year": 2025, "month": 2, "state_name": "Tirol <AT33>", "accommodation_name": "Hotel A", "F-ANK": 20, "F-UEB": 200},
            {"year": 2025, "month": 1, "state_name": "Wien <AT13>", "accommodation_name": "Hotel B", "F-ANK": 30, "F-UEB": 300},
            {"year": 2026, "month": 1, "state_name": "Salzburg <AT32>", "accommodation_name": "Hotel 5*", "F-ANK": 50, "F-UEB": 500},
            {"year": 2026, "month": 1, "state_name": "Salzburg <AT32>", "accommodation_name": "Ferienwohnung", "F-ANK": 40, "F-UEB": 400},
        ]
    )
    return engine


def test_value_answer() -> None:
    engine = make_engine()
    response = engine.answer("Wie viele Nächtigungen gab es 2025 in Tirol?")
    assert "300" in response.body
    assert response.table is None


def test_compare_answer() -> None:
    engine = make_engine()
    response = engine.answer("Vergleiche Wien und Tirol 2025 bei Ankünften")
    assert response.table is not None
    assert "Tirol" in response.table
    assert "Wien" in response.table


def test_ranking_answer() -> None:
    engine = make_engine()
    response = engine.answer("Welche Unterkunftsarten hatten in Salzburg im Jänner 2026 die meisten Nächtigungen?")
    assert response.table is not None
    assert "Hotel 5*" in response.table
    assert "Ferienwohnung" in response.table


def test_missing_metric_clarification() -> None:
    engine = make_engine()
    response = engine.answer("Wie lief Tirol 2025?")
    assert "Ankünfte oder Nächtigungen" in response.body
