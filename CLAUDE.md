# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

StatBot AT — a deterministic statistics chatbot MVP for Austrian Open Data (tourism/accommodation overnight stays from Statistik Austria). Natural language questions are parsed into structured queries, answered via Pandas aggregation on cached CSV data, and rendered as text/table/chart. The LLM is optional and only for prose explanation — all numbers come from the data pipeline.

## Commands

```bash
# Setup
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run
PYTHONPATH=src python -m statbot.cli "Wie viele Nächtigungen gab es 2025 in Österreich?"
PYTHONPATH=src python -m statbot.cli --refresh "..."   # force re-download from data.statistik.gv.at

# Tests
PYTHONPATH=src pytest -q
PYTHONPATH=src pytest tests/test_parser.py -q           # single file
PYTHONPATH=src pytest tests/test_parser.py::test_parser_trend_slots -q  # single test
```

`PYTHONPATH=src` is required for all commands — there is no setup.py/pyproject.toml.

## Architecture

```
Question → QueryParser → UserQuery (slots) → Engine → Pandas → Renderer → EngineResponse
```

**Pipeline flow:**
1. `parser.py` — Rule-based NLP: extracts metric, year, month, state(s), start_year, intent (`value`|`trend`|`compare_states`|`ranking_accommodation`) into a `UserQuery` dataclass. Handles German month names, Austrian state aliases, Unicode normalization.
2. `engine.py` — Routes by `query_type` to `_value`, `_trend`, `_compare_states`, or `_ranking_accommodation`. Applies filters, aggregates with Pandas, returns `EngineResponse`.
3. `fetch.py` — Downloads CSV fact table + code-list CSVs from `data.statistik.gv.at`, caches in `.cache/`, enriches DataFrame with human-readable state/accommodation names.
4. `catalog.py` — Immutable `DatasetSpec` defining the tourism dataset: URLs, dimension column IDs, metric column IDs (`F-ANK`=arrivals, `F-UEB`=overnights), code-list suffixes.
5. `render.py` — Sparkline chart, table formatting, month labels.
6. `cli.py` — Thin argparse wrapper calling `engine.answer()`.

**Key data columns after enrichment:** `year`, `month`, `state_name` (e.g. `"Tirol <AT33>"`), `accommodation_name`, `F-ANK`, `F-UEB`.

## Test Pattern

Tests bypass network I/O by constructing `StatisticsChatbotEngine` via `__new__` and injecting a hand-built DataFrame. Follow this pattern for new tests — no mocking framework needed.

## Language

All user-facing text (prompts, responses, clarification messages) is **German**. The system prompt in `prompts/system_prompt.txt` defines the LLM persona and hard rules.
