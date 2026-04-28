# IE 590 Final Project — Stochastic Dynamic Programming for Grid-Scale Battery Co-Optimization

**Author:** Ian Kleimans
**Course:** IE 590 (Purdue), Dr. Andrew L. Liu
**Topic:** Stochastic dynamic programming for a 100 MWh / 50 MW battery operating in PJM,
co-optimizing real-time energy arbitrage and frequency-regulation services.

The project compares three policies — perfect-foresight LP (upper bound), myopic-greedy
(lower bound), and model-predictive control (MPC) with an XGBoost LMP forecaster — and
reports revenue, optimality gap, and a revenue decomposition between energy and regulation.

## Quickstart

```bash
# 1. Install uv (https://docs.astral.sh/uv/) if needed
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Install the project + dependencies
uv sync

# 3. Run the test suite
uv run pytest --cov=src

# 4. Regenerate all figures (uses synthetic data if real PJM CSVs are absent)
uv run make figures

# 5. Build the report and slides (requires pandoc + Marp CLI)
make report
make slides
```

## Project layout

```
src/
  forecasting/    # XGBoost LMP forecaster
  policies/       # Perfect-foresight LP, myopic-greedy, MPC
  eval/           # Benchmark runner + figure generators
  utils/          # Synthetic data, PJM CSV loader, BatteryParams config
notebooks/        # 00 data inspection, 01 validation, 02 real-data results
tests/            # pytest suite, mirrors src/ layout
figures/          # Generated PNG (300 dpi) and PDF; captions.md alongside
report/           # IE590_final_report.md → PDF via pandoc
slides/           # IE590_final.md → PDF via Marp
data/pjm/         # Real PJM Data Miner 2 CSVs (gitignored). Optional.
```

## Math notation in code

The code matches the report notation:

| Symbol | Variable | Meaning |
|--------|----------|---------|
| `E_t`     | `E`     | State of charge at time $t$ (MWh) |
| `c_t`     | `c`     | Charge power (MW) |
| `d_t`     | `d`     | Discharge power (MW) |
| `b_reg_t` | `b_reg` | Regulation capacity bid (MW) |
| `eta_c`   | `eta_c` | Round-trip charge efficiency |
| `eta_d`   | `eta_d` | Round-trip discharge efficiency |
| `kappa`   | `kappa` | Marginal degradation cost ($/MWh throughput) |

## Data

If `data/pjm/rt_lmps.csv` is present (PJM Data Miner 2 export), the loader is used and
figures are labeled "Real PJM data." Otherwise a synthetic generator is used and figures
are clearly labeled as synthetic. There is no silent fallback in tests.

## Tests

Every non-trivial function has a pytest test. Coverage target: ≥70 % on `src/policies`.

```bash
uv run pytest --cov=src --cov-report=term-missing
```

## License

Educational use; please cite the underlying data sources (PJM Interconnection) and the
papers referenced in `report/IE590_final_report.md`.
