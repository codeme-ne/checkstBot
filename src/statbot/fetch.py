from __future__ import annotations

import io
import urllib.request
from pathlib import Path

import pandas as pd

from .catalog import DatasetSpec


class DataFetcher:
    def __init__(self, spec: DatasetSpec, cache_dir: str | Path | None = None) -> None:
        self.spec = spec
        self.cache_dir = Path(cache_dir or spec.cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _download(self, url: str, target: Path) -> Path:
        with urllib.request.urlopen(url) as response:
            target.write_bytes(response.read())
        return target

    def _ensure(self, filename: str, url: str, refresh: bool = False) -> Path:
        path = self.cache_dir / filename
        if refresh or not path.exists():
            self._download(url, path)
        return path

    def load_fact_table(self, refresh: bool = False) -> pd.DataFrame:
        path = self._ensure(f"{self.spec.dataset_id}.csv", self.spec.csv_url, refresh=refresh)
        return pd.read_csv(path, sep=";")

    def load_codelist(self, key: str, refresh: bool = False) -> pd.DataFrame:
        suffix = self.spec.code_lists[key]
        path = self._ensure(f"{self.spec.dataset_id}_{suffix}", self.spec.codelist_url(key), refresh=refresh)
        return pd.read_csv(path, sep=";")

    def load_enriched_dataframe(self, refresh: bool = False) -> pd.DataFrame:
        df = self.load_fact_table(refresh=refresh).copy()
        df[self.spec.dims["period"]] = df[self.spec.dims["period"]].astype(str)
        df["year"] = df[self.spec.dims["period"]].str[:4].astype(int)
        df["month"] = df[self.spec.dims["period"]].str[4:6].astype(int)

        state_map = self.load_codelist("state", refresh=refresh)[["code", "name"]].rename(
            columns={"code": self.spec.dims["state"], "name": "state_name"}
        )
        acc_map = self.load_codelist("accommodation", refresh=refresh)[["code", "name"]].rename(
            columns={"code": self.spec.dims["accommodation"], "name": "accommodation_name"}
        )

        df = df.merge(state_map, on=self.spec.dims["state"], how="left")
        df = df.merge(acc_map, on=self.spec.dims["accommodation"], how="left")
        return df
