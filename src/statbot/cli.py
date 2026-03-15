from __future__ import annotations

import argparse

from .engine import StatisticsChatbotEngine


def main() -> None:
    parser = argparse.ArgumentParser(description="Statistik-Chatbot CLI (MVP)")
    parser.add_argument("question", nargs="+", help="Natürliche Frage an den Chatbot")
    parser.add_argument("--refresh", action="store_true", help="Daten neu von data.statistik.gv.at laden")
    parser.add_argument("--cache-dir", default=".cache", help="Cache-Verzeichnis für CSV-Dateien")
    args = parser.parse_args()

    engine = StatisticsChatbotEngine(refresh=args.refresh, cache_dir=args.cache_dir)
    question = " ".join(args.question)
    response = engine.answer(question)

    print(f"\n# {response.headline}\n")
    print(response.body)
    if response.chart:
        print(f"\nChart\n-----\n{response.chart}")
    if response.table:
        print(f"\nTabelle\n-------\n{response.table}")
    print(f"\n{response.source}\n")


if __name__ == "__main__":
    main()
