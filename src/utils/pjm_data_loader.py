"""Load PJM Data Miner 2 CSV exports into clean tz-aware time series.

Spec'd loaders:

* :func:`load_rt_lmps`     — real-time LMPs at a single pnode.
* :func:`load_reg_prices`  — regulation capacity / performance clearing prices.

Both apply a small forward-fill of up to two consecutive missing intervals
and otherwise raise :class:`IncompleteDataError`.  No silent fallback.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

import pandas as pd


_FIVE_MIN = pd.Timedelta("5min")
_MAX_FFILL_INTERVALS = 2


class IncompleteDataError(ValueError):
    """Raised when a PJM CSV has more than ``_MAX_FFILL_INTERVALS`` consecutive gaps."""


def _parse_ept_to_utc(series: pd.Series) -> pd.DatetimeIndex:
    """Parse a Data Miner 2 ``datetime_beginning_ept`` column into a UTC index.

    PJM marks Eastern Prevailing Time, which is ``America/New_York`` (handles
    DST).  We localise then convert to UTC for internal use.
    """
    ts = pd.to_datetime(series, errors="raise")
    if ts.dt.tz is None:
        # Ambiguous times can occur on DST fall-back; use 'infer' to pair with NDST flag
        # but PJM CSVs usually disambiguate by explicit ept column ordering — we
        # take the safe choice of treating ambiguous as DST=False and nonexistent as
        # shifting forward.
        ts = ts.dt.tz_localize("America/New_York", ambiguous="infer", nonexistent="shift_forward")
    return pd.DatetimeIndex(ts.dt.tz_convert("UTC"))


def _ffill_with_gap_check(
    series: pd.Series,
    max_consecutive: int = _MAX_FFILL_INTERVALS,
) -> pd.Series:
    """Forward-fill at most ``max_consecutive`` NaNs; raise otherwise."""
    is_na = series.isna()
    if not is_na.any():
        return series

    # Detect runs of NaN
    run_id = (is_na != is_na.shift()).cumsum()
    runs = is_na.groupby(run_id).sum()
    long_run = runs[runs > max_consecutive]
    if not long_run.empty:
        worst = int(long_run.max())
        raise IncompleteDataError(
            f"PJM data has {worst} consecutive missing intervals (>{max_consecutive}); "
            "refusing silent fallback."
        )
    return series.ffill(limit=max_consecutive)


def _ensure_complete_grid(series: pd.Series, freq: pd.Timedelta = _FIVE_MIN) -> pd.Series:
    """Reindex onto a complete 5-min grid between min and max timestamps."""
    if series.empty:
        return series
    full_idx = pd.date_range(series.index.min(), series.index.max(), freq=freq, tz="UTC")
    return series.reindex(full_idx)


def load_rt_lmps(filepath: str | Path, pnode_id: int) -> pd.Series:
    """Load real-time 5-min LMPs for a given pnode from a Data Miner 2 export.

    Expected CSV columns (Data Miner 2 ``rt_fivemin_hrl_lmps`` or similar):

    * ``datetime_beginning_ept``
    * ``pnode_id`` (integer)
    * ``total_lmp_rt`` (USD/MWh, float)

    Other columns are tolerated and ignored.

    Parameters
    ----------
    filepath
        Path to the CSV file.
    pnode_id
        Integer pnode identifier to filter on.

    Returns
    -------
    pd.Series
        Tz-aware UTC-indexed series of LMPs ($/MWh), name ``lmp``.
    """
    fp = Path(filepath)
    if not fp.exists():
        raise FileNotFoundError(f"PJM RT LMP file not found: {fp}")

    df = pd.read_csv(fp)
    required = {"datetime_beginning_ept", "pnode_id", "total_lmp_rt"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"{fp}: missing required columns {missing}; got {list(df.columns)}"
        )

    df = df[df["pnode_id"].astype(int) == int(pnode_id)].copy()
    if df.empty:
        raise ValueError(f"No rows for pnode_id={pnode_id} in {fp}")

    df["_utc"] = _parse_ept_to_utc(df["datetime_beginning_ept"])
    df = df.sort_values("_utc")
    series = pd.Series(df["total_lmp_rt"].astype(float).to_numpy(), index=df["_utc"], name="lmp")
    series = series[~series.index.duplicated(keep="first")]

    series = _ensure_complete_grid(series)
    series = _ffill_with_gap_check(series)
    series.name = "lmp"
    return series


def load_reg_prices(filepath: str | Path) -> pd.DataFrame:
    """Load PJM regulation clearing prices from a Data Miner 2 export.

    Two schemas are supported transparently:

    * **Pre-2025 schema**: ``rmccp`` / ``rmpcp`` (legacy two-product market).
    * **Post-2025 redesign**: ``capability_clearing_price`` /
      ``performance_clearing_price``.  The 2026 PJM RTO data lives under this
      schema.

    The function returns a single DataFrame whichever schema is present.

    Expected columns (post-2025):

    * ``datetime_beginning_ept``
    * ``capability_clearing_price`` (regulation market capability clearing price, $/MW-h)
    * ``performance_clearing_price`` (regulation market performance clearing price, $/MW-h)

    Returns
    -------
    pd.DataFrame
        Tz-aware UTC-indexed frame with columns ``reg_cap_price`` and
        ``reg_perf_price``.
    """
    fp = Path(filepath)
    if not fp.exists():
        raise FileNotFoundError(f"PJM regulation price file not found: {fp}")

    df = pd.read_csv(fp)

    if {"capability_clearing_price", "performance_clearing_price"}.issubset(df.columns):
        cap_col = "capability_clearing_price"
        perf_col = "performance_clearing_price"
    elif {"rmccp", "rmpcp"}.issubset(df.columns):
        cap_col = "rmccp"
        perf_col = "rmpcp"
    else:
        raise ValueError(
            f"{fp}: missing regulation columns. Expected either "
            "(capability_clearing_price, performance_clearing_price) or (rmccp, rmpcp); "
            f"got {list(df.columns)}"
        )
    if "datetime_beginning_ept" not in df.columns:
        raise ValueError(f"{fp}: missing column datetime_beginning_ept; got {list(df.columns)}")

    df["_utc"] = _parse_ept_to_utc(df["datetime_beginning_ept"])
    df = df.sort_values("_utc").drop_duplicates(subset="_utc", keep="first")

    cap = pd.Series(df[cap_col].astype(float).to_numpy(), index=df["_utc"], name="reg_cap_price")
    perf = pd.Series(df[perf_col].astype(float).to_numpy(), index=df["_utc"], name="reg_perf_price")

    # Regulation prices are hourly in PJM; expand onto 5-min grid by ffill
    full_idx = pd.date_range(cap.index.min(), cap.index.max() + pd.Timedelta("55min"),
                             freq=_FIVE_MIN, tz="UTC")
    cap = cap.reindex(full_idx).ffill(limit=11)
    perf = perf.reindex(full_idx).ffill(limit=11)

    if cap.isna().any() or perf.isna().any():
        raise IncompleteDataError(
            f"{fp}: regulation prices have unfillable gaps (>1 hour)."
        )

    return pd.DataFrame({"reg_cap_price": cap, "reg_perf_price": perf})


def align_lmp_and_reg(
    lmps: pd.Series,
    reg: pd.DataFrame,
) -> pd.DataFrame:
    """Inner-join LMP and reg prices on a shared 5-min UTC grid."""
    if lmps.index.tz is None or reg.index.tz is None:
        raise ValueError("Both inputs must be tz-aware.")
    df = pd.concat([lmps, reg], axis=1, join="inner")
    if df.isna().any().any():
        raise IncompleteDataError("Aligned LMP/reg frame still has NaN entries.")
    return df


# The default pnode is AEP-DAYTON HUB, the location backing the 2026 RT-LMP CSV
# in ``data/pjm/rt_lmps.csv``.  Change to your pnode of choice when calling
# ``load_rt_lmps`` with a different region.
DEFAULT_PNODE_ID: int = 34497127  # AEP-DAYTON HUB
DEFAULT_PNODE_NAME: str = "AEP-DAYTON HUB"


def find_real_or_synthetic(data_dir: str | Path = "data/pjm") -> tuple[bool, str]:
    """Detect whether real PJM CSVs are present.

    Returns
    -------
    (using_real, label)
        ``using_real`` is True iff ``rt_lmps.csv`` exists in ``data_dir``;
        ``label`` is a short string suitable for figure annotations.
    """
    fp = Path(data_dir) / "rt_lmps.csv"
    if fp.exists():
        return True, f"Real PJM data ({DEFAULT_PNODE_NAME})"
    return False, "Synthetic data (illustrative)"
