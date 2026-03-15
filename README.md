# Redlink Case Study – Statistik-Chatbot MVP

Minimaler, robuster Python-CLI-Prototyp für einen statistikbasierten Chatbot auf Basis österreichischer Open Data von Statistik Austria.

## Ziel

Der MVP beantwortet häufige Statistikfragen **nicht** direkt mit einem LLM, sondern über eine deterministische Datenpipeline:

1. natürliche Frage parsen,
2. Zeitraum / Bundesland / Kennzahl extrahieren,
3. Open-Data-CSV von `data.statistik.gv.at` laden,
4. Aggregation mit Pandas berechnen,
5. Ergebnis als Text, Tabelle oder ASCII-Chart ausgeben.

Das LLM ist in dieser Repo-Version **optional** und nur für die sprachliche Erklärung vorgesehen. Die Zahlen entstehen immer aus der Datenlogik.

## Gewählter Datensatz

- **Datensatz:** Nächtigungsstatistik ab November 1973 – Nächtigungen nach Unterkunftsarten und Bundesländern
- **Portal:** Statistik Austria Open Data (`data.statistik.gv.at`)
- **Formate:** CSV und JSON
- **Kennzahlen:** `F-ANK` (Ankünfte), `F-UEB` (Nächtigungen)
- **Dimensionen:** Zeitraum, Bundesland, Unterkunftsart

## Warum dieser Datensatz?

- fachlich leicht verständlich,
- monatlich aktualisiert,
- lange Zeitreihe,
- stabile Granularität,
- gut für Wert-, Trend-, Vergleichs- und Ranking-Fragen,
- für einen Interview-MVP klein genug für lokales Caching.

## Repo-Struktur

```text
redlink_case_study_repo/
├── README.md
├── requirements.txt
├── prompts/
│   └── system_prompt.txt
├── src/
│   └── statbot/
│       ├── __init__.py
│       ├── catalog.py
│       ├── cli.py
│       ├── engine.py
│       ├── fetch.py
│       ├── parser.py
│       └── render.py
└── tests/
    ├── test_engine.py
    └── test_parser.py
```

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export PYTHONPATH=src
```

## Start

```bash
python -m statbot.cli "Wie viele Nächtigungen gab es 2025 in Österreich?"
```

Beim ersten Start werden die CSV-Dateien automatisch von Statistik Austria geladen und lokal im Cache gespeichert.

## Unterstützte Fragetypen

### 1) Einzelwert
```bash
python -m statbot.cli "Wie viele Nächtigungen gab es 2025 in Österreich?"
```
Beispielausgabe:
```text
# Wertabfrage

Nächtigungen in Österreich für 2025: 157.291.806.

Quelle: Statistik Austria Open Data – Nächtigungsstatistik nach Unterkunftsarten und Bundesländern (data.statistik.gv.at).
```

### 2) Trend
```bash
python -m statbot.cli "Wie haben sich Nächtigungen in Tirol seit 2019 entwickelt?"
```
Beispielausgabe:
```text
# Trendanalyse

Trend Nächtigungen in Tirol für seit 2019.

Chart
-----
█▃▁▇▇██  2019 2020 2021 2022 2023 2024 2025
```

### 3) Ranking
```bash
python -m statbot.cli "Welche Unterkunftsarten hatten in Salzburg im Jänner 2026 die meisten Nächtigungen?"
```
Beispielausgabe:
```text
# Ranking Unterkunftsarten

Top-Unterkunftsarten nach Nächtigungen in Salzburg für Jän 2026.

Tabelle
-------
                                   Unterkunftsart  Nächtigungen
 Hotel o.ä.Betr.,Kat.5/4-Stern(Superior) <01>      1272305
 Ferienwohnung/-haus (gewerbl.)(ab11/97) <04>       885834
 Hotel od. ähnl. Betrieb, Kateg.3-Stern <02>        735684
```

## Architektur

```text
User-Frage
  -> QueryParser
  -> QueryPlan (metric, year, month, state, intent)
  -> DataFetcher + Cache
  -> Pandas Aggregation
  -> Renderer (Text / Tabelle / ASCII-Chart)
  -> optionale LLM-Erklärung mit kompaktem JSON-Kontext
```

## Kontextstrategie für ein LLM

Das LLM bekommt **nie die Rohdaten**. Stattdessen nur:
- Originalfrage,
- strukturierten QueryPlan,
- Datensatzname und Datenstand,
- kompaktes Resultat (`top_rows`, Summen, Filter),
- Render-Empfehlung.

Dadurch bleiben Kosten und Halluzinationsrisiko klein.

## Grenzen des MVP

- nur ein Datensatz,
- nur Bundeslandebene,
- keine Herkunftsländer,
- keine Frontend-Visualisierung,
- keine Multi-Turn-Dialogverwaltung,
- Parser ist bewusst regelbasiert und deckt nicht jede Formulierung ab.

## Nächste sinnvolle Ausbaustufe

1. zweites Datenset derselben Familie: Herkunftsländer,
2. strukturierter Query-Router über mehrere Statistik-Austria-Datensätze,
3. optionale LLM-Schicht für bessere Umformulierungen und Klarifikationen,
4. Web-Frontend mit Quellenanzeige und Export.

## Tests

```bash
PYTHONPATH=src pytest -q
```

Die Tests prüfen Parser-Logik und Basis-Szenarien des Engines.
