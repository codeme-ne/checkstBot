from statbot.parser import QueryParser


def test_parser_trend_slots() -> None:
    parser = QueryParser()
    q = parser.parse("Wie haben sich Nächtigungen in Tirol seit 2019 entwickelt?")
    assert q.metric == "naechtigungen"
    assert q.query_type == "trend"
    assert q.states == ["Tirol"]
    assert q.start_year == 2019


def test_parser_ranking_defaults_metric() -> None:
    parser = QueryParser()
    q = parser.parse("Welche Unterkunftsarten hatten in Salzburg im Jänner 2026 die meisten Nächtigungen?")
    assert q.query_type == "ranking_accommodation"
    assert q.metric == "naechtigungen"
    assert q.month == 1
    assert q.year == 2026
    assert q.states == ["Salzburg"]


def test_parser_compare_two_states() -> None:
    parser = QueryParser()
    q = parser.parse("Vergleiche Wien und Tirol 2025 bei Ankünften")
    assert q.query_type == "compare_states"
    assert q.metric == "ankuenfte"
    assert set(q.states) == {"Wien", "Tirol"}
    assert q.year == 2025
