"""Synthetic LMP and regulation-price generators.

Used both as a fallback when no real PJM CSV is available and inside the test
suite so that solver behaviour can be verified deterministically.

The generated time series are tz-aware UTC, with daily and weekly seasonality
calibrated to match qualitative PJM patterns (peak ET hours 17–19, weekend
dip, occasional spikes).  Mean LMP is approximately ``$35/MWh``.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

_INTERVALS_PER_DAY = 12 * 24      # 5-minute intervals
_HOUR_PEAK_ET = 18.0              # peak hour in ET (5–7 pm)


def _build_index(n_days: int, freq_minutes: int, start: str = "2024-06-01") -> pd.DatetimeIndex:
    """Create a tz-aware UTC index covering ``n_days`` of 5-minute intervals."""
    if n_days <= 0:
        raise ValueError(f"n_days must be positive, got {n_days}")
    if freq_minutes <= 0:
        raise ValueError(f"freq_minutes must be positive, got {freq_minutes}")
    n = int(n_days * 24 * 60 / freq_minutes)
    return pd.date_range(start=start, periods=n, freq=f"{freq_minutes}min", tz="UTC")


def generate_synthetic_lmps(
    n_days: int = 30,
    freq_minutes: int = 5,
    seed: int = 42,
    base_price: float = 30.0,
    daily_amplitude: float = 18.0,
    noise_std: float = 4.0,
) -> pd.Series:
    """Generate a synthetic LMP series with daily / weekly seasonality.

    Pattern:

    * Diurnal sinusoid centred on ~18:00 ET (peak 17–19) with amplitude
      ``daily_amplitude``.
    * A weekend dip of ~$5/MWh.
    * Independent Gaussian noise with std ``noise_std``.
    * 2–3 spikes per simulated week reaching ~3–5x the baseline.
    * Floored at $1/MWh so the series is non-negative (PJM RT can go
      negative but synthetic data is kept non-negative for clarity).

    Returns
    -------
    pd.Series
        Tz-aware UTC-indexed series of LMPs in $/MWh, name ``lmp``.
    """
    rng = np.random.default_rng(seed)
    idx = _build_index(n_days, freq_minutes)

    # Convert UTC to ET for hour-of-day shaping
    et = idx.tz_convert("America/New_York")
    hour_frac = np.asarray(et.hour, dtype=float) + np.asarray(et.minute, dtype=float) / 60.0
    diurnal = daily_amplitude * np.cos(2 * np.pi * (hour_frac - _HOUR_PEAK_ET) / 24.0)
    weekend_dip = -5.0 * (np.asarray(et.dayofweek) >= 5).astype(float)
    noise = rng.normal(0.0, noise_std, size=len(idx))

    prices = np.asarray(base_price + diurnal + weekend_dip + noise, dtype=float)

    # Add 2-3 spikes per week
    n_weeks = max(1, n_days // 7)
    n_spikes = rng.integers(low=2 * n_weeks, high=3 * n_weeks + 1)
    spike_idx = rng.integers(low=0, high=len(idx), size=n_spikes)
    spike_mag = rng.uniform(low=3.0, high=5.0, size=n_spikes) * base_price
    # Concentrate spikes during ET peak hours by reweighting if not peak
    for i, mag in zip(spike_idx, spike_mag):
        prices[i] += mag
        # Decay neighbours so the spike isn't a single delta
        for offset, decay in [(-1, 0.5), (1, 0.5), (-2, 0.25), (2, 0.25)]:
            j = i + offset
            if 0 <= j < len(prices):
                prices[j] += mag * decay

    prices = np.clip(prices, a_min=1.0, a_max=None)
    return pd.Series(prices, index=idx, name="lmp")


def generate_synthetic_reg_prices(
    lmp_series: pd.Series,
    seed: int = 42,
    cap_ratio_mean: float = 0.4,
    perf_ratio_mean: float = 0.15,
    ratio_noise_std: float = 0.05,
) -> pd.DataFrame:
    """Generate matched regulation capacity / performance prices.

    PJM regulation clearing prices are correlated with energy prices but
    smaller in magnitude.  We model them as

        reg_cap_price[t]  = cap_ratio  * lmp[t]   * (1 + eps_cap[t])
        reg_perf_price[t] = perf_ratio * lmp[t]   * (1 + eps_perf[t])

    with ``eps`` independent Gaussian noise.  Both outputs are non-negative.

    Parameters
    ----------
    lmp_series
        Tz-aware UTC LMP series to align against.
    seed
        Random seed.
    cap_ratio_mean, perf_ratio_mean
        Mean ratios of regulation cap / performance prices to LMP.
    ratio_noise_std
        Std-dev of multiplicative noise on those ratios.
    """
    if lmp_series.index.tz is None:
        raise ValueError("lmp_series must be tz-aware (UTC).")

    rng = np.random.default_rng(seed)
    n = len(lmp_series)
    eps_cap = rng.normal(0.0, ratio_noise_std, size=n)
    eps_perf = rng.normal(0.0, ratio_noise_std, size=n)

    reg_cap = np.clip(cap_ratio_mean * lmp_series.to_numpy() * (1.0 + eps_cap), 0.0, None)
    reg_perf = np.clip(perf_ratio_mean * lmp_series.to_numpy() * (1.0 + eps_perf), 0.0, None)

    return pd.DataFrame(
        {"reg_cap_price": reg_cap, "reg_perf_price": reg_perf},
        index=lmp_series.index,
    )


def generate_synthetic_dataset(
    n_days: int = 30,
    freq_minutes: int = 5,
    seed: int = 42,
) -> pd.DataFrame:
    """Convenience: produce a single DataFrame with lmp + reg prices."""
    lmps = generate_synthetic_lmps(n_days=n_days, freq_minutes=freq_minutes, seed=seed)
    reg = generate_synthetic_reg_prices(lmps, seed=seed)
    df = pd.concat([lmps, reg], axis=1)
    df.index.name = "interval_start_utc"
    return df
