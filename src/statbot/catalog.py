from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class DatasetSpec:
    dataset_id: str
    name: str
    base_url: str
    dims: dict[str, str]
    metrics: dict[str, str]
    code_lists: dict[str, str]
    cache_dir: Path = field(default=Path('.cache'))

    @property
    def csv_url(self) -> str:
        return f"{self.base_url}/{self.dataset_id}.csv"

    @property
    def header_url(self) -> str:
        return f"{self.base_url}/{self.dataset_id}_HEADER.csv"

    def codelist_url(self, key: str) -> str:
        suffix = self.code_lists[key]
        return f"{self.base_url}/{self.dataset_id}_{suffix}.csv"


TOURISM_BY_ACCOMMODATION = DatasetSpec(
    dataset_id="OGD_touextsai_Tour_UA_1",
    name="Nächtigungsstatistik ab November 1973 - Nächtigungen nach Unterkunftsarten und Bundesländern",
    base_url="https://data.statistik.gv.at/data",
    dims={
        "period": "C-SDB_TIT-0",
        "state": "C-W96-0",
        "accommodation": "C-BBTR-0",
    },
    metrics={
        "ankuenfte": "F-ANK",
        "naechtigungen": "F-UEB",
    },
    code_lists={
        "period": "C-SDB_TIT-0.csv",
        "state": "C-W96-0.csv",
        "accommodation": "C-BBTR-0.csv",
    },
)
