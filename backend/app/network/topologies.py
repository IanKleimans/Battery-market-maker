"""Standard test-system topologies: 5-bus, IEEE 14-bus, IEEE 30-bus.

Bus coordinates are chosen to render well in a 1200x800 viewport.  The IEEE
layouts are *not* the standard published one-line diagrams — they have been
hand-arranged here to minimise line crossings at this aspect ratio.

Impedance and generator data are derived from the standard MATPOWER cases
``case5``, ``case14``, ``case30``.  Per-unit impedances are on a 100 MVA system
base.  Marginal cost numbers are illustrative (real PJM offers are confidential)
and are tuned so the merit order matches the typical fuel-cost ranking.
"""

from __future__ import annotations

from app.schemas.network import Bus, Generator, Line, Load, NetworkData


# ---------------------------------------------------------------------------
# 5-bus (PJM 5-bus from Lin & Glavic, Schweppe-style)
# ---------------------------------------------------------------------------


def _network_5bus() -> NetworkData:
    """5-bus tutorial network mirroring the original simulator."""
    buses = [
        Bus(id=1, name="Bus 1",  base_kv=230, x=200,  y=200, is_slack=True),
        Bus(id=2, name="Bus 2",  base_kv=230, x=600,  y=120),
        Bus(id=3, name="Bus 3",  base_kv=230, x=1000, y=200),
        Bus(id=4, name="Bus 4",  base_kv=230, x=1000, y=600),
        Bus(id=5, name="Bus 5",  base_kv=230, x=200,  y=600),
    ]
    lines = [
        Line(id=1, from_bus=1, to_bus=2, name="L1-2", reactance=0.0281, capacity_mva=400),
        Line(id=2, from_bus=1, to_bus=4, name="L1-4", reactance=0.0304, capacity_mva=400),
        Line(id=3, from_bus=1, to_bus=5, name="L1-5", reactance=0.0064, capacity_mva=400),
        Line(id=4, from_bus=2, to_bus=3, name="L2-3", reactance=0.0108, capacity_mva=400),
        Line(id=5, from_bus=3, to_bus=4, name="L3-4", reactance=0.0297, capacity_mva=240),
        Line(id=6, from_bus=4, to_bus=5, name="L4-5", reactance=0.0297, capacity_mva=240),
    ]
    generators = [
        Generator(id=1, bus=1, name="G1 Coal",   fuel="coal",    capacity_mw=170, cost_per_mwh=14.0, ramp_rate_mw_per_min=3),
        Generator(id=2, bus=1, name="G2 Nuc",    fuel="nuclear", capacity_mw=200, cost_per_mwh=8.0,  ramp_rate_mw_per_min=2),
        Generator(id=3, bus=3, name="G3 Gas",    fuel="gas",     capacity_mw=323, cost_per_mwh=35.0, ramp_rate_mw_per_min=8),
        Generator(id=4, bus=4, name="G4 Hydro",  fuel="hydro",   capacity_mw=200, cost_per_mwh=12.0, ramp_rate_mw_per_min=15),
        Generator(id=5, bus=5, name="G5 GasCT",  fuel="gas",     capacity_mw=600, cost_per_mwh=40.0, ramp_rate_mw_per_min=10),
    ]
    loads = [
        Load(bus=2, peak_mw=300, profile_type="commercial"),
        Load(bus=3, peak_mw=300, profile_type="industrial"),
        Load(bus=4, peak_mw=400, profile_type="residential"),
    ]
    return NetworkData(
        name="bus5",
        display_name="5-Bus Classic",
        buses=buses,
        lines=lines,
        generators=generators,
        loads=loads,
    )


# ---------------------------------------------------------------------------
# IEEE 14-bus
# ---------------------------------------------------------------------------


def _network_ieee14() -> NetworkData:
    """IEEE 14-bus with hand-tuned layout for a 1200x800 viewport."""

    # Layout: three voltage levels, left-to-right.
    # 230kV ring on top (1-5), 132kV middle (6-13), 33kV pocket (9-14).
    buses = [
        Bus(id=1,  name="Bus 1",  base_kv=132, x=120,  y=160, is_slack=True),
        Bus(id=2,  name="Bus 2",  base_kv=132, x=320,  y=80),
        Bus(id=3,  name="Bus 3",  base_kv=132, x=560,  y=80),
        Bus(id=4,  name="Bus 4",  base_kv=132, x=560,  y=260),
        Bus(id=5,  name="Bus 5",  base_kv=132, x=320,  y=260),
        Bus(id=6,  name="Bus 6",  base_kv=33,  x=320,  y=460),
        Bus(id=7,  name="Bus 7",  base_kv=33,  x=560,  y=460),
        Bus(id=8,  name="Bus 8",  base_kv=18,  x=720,  y=540),
        Bus(id=9,  name="Bus 9",  base_kv=33,  x=720,  y=420),
        Bus(id=10, name="Bus 10", base_kv=33,  x=560,  y=620),
        Bus(id=11, name="Bus 11", base_kv=33,  x=380,  y=620),
        Bus(id=12, name="Bus 12", base_kv=33,  x=200,  y=560),
        Bus(id=13, name="Bus 13", base_kv=33,  x=200,  y=720),
        Bus(id=14, name="Bus 14", base_kv=33,  x=900,  y=540),
    ]

    # MATPOWER case14 reactances on 100 MVA base
    line_data: list[tuple[int, int, float, float]] = [
        # (from, to, x, capacity_mva)
        (1,  2,  0.05917, 200),
        (1,  5,  0.22304, 200),
        (2,  3,  0.19797, 200),
        (2,  4,  0.17632, 200),
        (2,  5,  0.17388, 200),
        (3,  4,  0.17103, 200),
        (4,  5,  0.04211, 300),
        (4,  7,  0.20912, 100),
        (4,  9,  0.55618, 100),
        (5,  6,  0.25202, 100),
        (6, 11,  0.19890, 80),
        (6, 12,  0.25581, 80),
        (6, 13,  0.13027, 80),
        (7,  8,  0.17615, 100),
        (7,  9,  0.11001, 100),
        (9, 10,  0.08450, 80),
        (9, 14,  0.27038, 80),
        (10, 11, 0.19207, 60),
        (12, 13, 0.19988, 60),
        (13, 14, 0.34802, 60),
    ]
    lines = [
        Line(id=i + 1, from_bus=f, to_bus=t, name=f"L{f}-{t}", reactance=x, capacity_mva=cap)
        for i, (f, t, x, cap) in enumerate(line_data)
    ]

    generators = [
        Generator(id=1, bus=1, name="G1 Nuclear",  fuel="nuclear", capacity_mw=332, cost_per_mwh=8.0,  ramp_rate_mw_per_min=2,  min_output_mw=100),
        Generator(id=2, bus=2, name="G2 Coal",     fuel="coal",    capacity_mw=140, cost_per_mwh=18.0, ramp_rate_mw_per_min=4),
        Generator(id=3, bus=3, name="G3 Gas CCGT", fuel="gas",     capacity_mw=100, cost_per_mwh=32.0, ramp_rate_mw_per_min=10),
        Generator(id=4, bus=6, name="G4 Hydro",    fuel="hydro",   capacity_mw=100, cost_per_mwh=12.0, ramp_rate_mw_per_min=20),
        Generator(id=5, bus=8, name="G5 Gas CT",   fuel="gas",     capacity_mw=100, cost_per_mwh=55.0, ramp_rate_mw_per_min=15),
    ]

    # MATPOWER case14 loads (MW)
    loads = [
        Load(bus=2,  peak_mw=21.7, profile_type="residential"),
        Load(bus=3,  peak_mw=94.2, profile_type="industrial"),
        Load(bus=4,  peak_mw=47.8, profile_type="commercial"),
        Load(bus=5,  peak_mw=7.6,  profile_type="commercial"),
        Load(bus=6,  peak_mw=11.2, profile_type="residential"),
        Load(bus=9,  peak_mw=29.5, profile_type="commercial"),
        Load(bus=10, peak_mw=9.0,  profile_type="residential"),
        Load(bus=11, peak_mw=3.5,  profile_type="residential"),
        Load(bus=12, peak_mw=6.1,  profile_type="residential"),
        Load(bus=13, peak_mw=13.5, profile_type="commercial"),
        Load(bus=14, peak_mw=14.9, profile_type="residential"),
    ]

    return NetworkData(
        name="ieee14",
        display_name="IEEE 14-Bus",
        buses=buses,
        lines=lines,
        generators=generators,
        loads=loads,
    )


# ---------------------------------------------------------------------------
# IEEE 30-bus
# ---------------------------------------------------------------------------


def _network_ieee30() -> NetworkData:
    """IEEE 30-bus with hand-tuned layout."""

    # 6 columns x 5 rows-ish layout.  Tuned so transmission backbone reads L→R.
    bus_xy: dict[int, tuple[int, int]] = {
        1:  (100, 120),
        2:  (260, 80),
        3:  (260, 220),
        4:  (420, 200),
        5:  (100, 320),
        6:  (420, 320),
        7:  (260, 360),
        8:  (580, 320),
        9:  (580, 460),
        10: (740, 460),
        11: (580, 580),
        12: (260, 560),
        13: (100, 560),
        14: (420, 560),
        15: (420, 700),
        16: (580, 700),
        17: (740, 580),
        18: (900, 700),
        19: (900, 560),
        20: (1060, 580),
        21: (740, 360),
        22: (900, 360),
        23: (900, 220),
        24: (1060, 360),
        25: (1060, 220),
        26: (1100, 100),
        27: (1100, 460),
        28: (740, 220),
        29: (1100, 580),
        30: (1100, 700),
    }
    buses = [
        Bus(
            id=i,
            name=f"Bus {i}",
            base_kv=132 if i <= 6 else 33,
            x=bus_xy[i][0],
            y=bus_xy[i][1],
            is_slack=(i == 1),
        )
        for i in range(1, 31)
    ]

    # Subset of MATPOWER case30 lines (ids assigned sequentially)
    line_data: list[tuple[int, int, float, float]] = [
        (1, 2,   0.0575, 130), (1, 3,   0.1852, 130), (2, 4,  0.1737, 65),
        (3, 4,   0.0379, 130), (2, 5,   0.1983, 130), (2, 6,  0.1763, 65),
        (4, 6,   0.0414, 90),  (5, 7,   0.1160, 70),  (6, 7,  0.0820, 130),
        (6, 8,   0.0420, 32),  (6, 9,   0.2080, 65),  (6, 10, 0.5560, 32),
        (9, 11,  0.2080, 65),  (9, 10,  0.1100, 65),  (4, 12, 0.2560, 65),
        (12, 13, 0.1400, 65),  (12, 14, 0.2559, 32),  (12, 15, 0.1304, 32),
        (12, 16, 0.1987, 32),  (14, 15, 0.1997, 16),  (16, 17, 0.1932, 16),
        (15, 18, 0.2185, 16),  (18, 19, 0.1292, 16),  (19, 20, 0.0680, 32),
        (10, 20, 0.2090, 32),  (10, 17, 0.0845, 32),  (10, 21, 0.0749, 32),
        (10, 22, 0.1499, 32),  (21, 22, 0.0236, 32),  (15, 23, 0.2020, 16),
        (22, 24, 0.1790, 16),  (23, 24, 0.2700, 16),  (24, 25, 0.3292, 16),
        (25, 26, 0.3800, 16),  (25, 27, 0.2087, 16),  (28, 27, 0.3960, 65),
        (27, 29, 0.4153, 16),  (27, 30, 0.6027, 16),  (29, 30, 0.4533, 16),
        (8, 28,  0.2000, 32),  (6, 28,  0.0599, 32),
    ]
    lines = [
        Line(id=i + 1, from_bus=f, to_bus=t, name=f"L{f}-{t}", reactance=x, capacity_mva=cap)
        for i, (f, t, x, cap) in enumerate(line_data)
    ]

    generators = [
        Generator(id=1, bus=1,  name="G1 Nuclear", fuel="nuclear", capacity_mw=200, cost_per_mwh=8.0,  ramp_rate_mw_per_min=2,  min_output_mw=80),
        Generator(id=2, bus=2,  name="G2 Coal",    fuel="coal",    capacity_mw=80,  cost_per_mwh=18.0, ramp_rate_mw_per_min=3),
        Generator(id=3, bus=22, name="G3 Gas CC",  fuel="gas",     capacity_mw=50,  cost_per_mwh=32.0, ramp_rate_mw_per_min=8),
        Generator(id=4, bus=27, name="G4 Gas CC",  fuel="gas",     capacity_mw=55,  cost_per_mwh=34.0, ramp_rate_mw_per_min=8),
        Generator(id=5, bus=23, name="G5 Hydro",   fuel="hydro",   capacity_mw=30,  cost_per_mwh=12.0, ramp_rate_mw_per_min=15),
        Generator(id=6, bus=13, name="G6 Gas CT",  fuel="gas",     capacity_mw=40,  cost_per_mwh=55.0, ramp_rate_mw_per_min=15),
    ]

    # MATPOWER case30 loads
    load_data: list[tuple[int, float, str]] = [
        (2, 21.7, "residential"), (3, 2.4, "residential"), (4, 7.6, "commercial"),
        (5, 94.2, "industrial"),  (7, 22.8, "commercial"), (8, 30.0, "industrial"),
        (10, 5.8, "residential"), (12, 11.2, "commercial"), (14, 6.2, "residential"),
        (15, 8.2, "commercial"),  (16, 3.5, "residential"), (17, 9.0, "commercial"),
        (18, 3.2, "residential"), (19, 9.5, "commercial"), (20, 2.2, "residential"),
        (21, 17.5, "industrial"), (23, 3.2, "residential"), (24, 8.7, "commercial"),
        (26, 3.5, "residential"), (29, 2.4, "residential"), (30, 10.6, "commercial"),
    ]
    loads = [Load(bus=b, peak_mw=mw, profile_type=p) for b, mw, p in load_data]

    return NetworkData(
        name="ieee30",
        display_name="IEEE 30-Bus",
        buses=buses,
        lines=lines,
        generators=generators,
        loads=loads,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_NETWORKS: dict[str, NetworkData] = {
    "bus5": _network_5bus(),
    "ieee14": _network_ieee14(),
    "ieee30": _network_ieee30(),
}

_DESCRIPTIONS: dict[str, str] = {
    "bus5": "Five-bus tutorial network — mirrors the original simulator base case.",
    "ieee14": "IEEE 14-bus standard test system with two transformers and four reactive compensators.",
    "ieee30": "IEEE 30-bus system, useful for demonstrating congestion and locational price spread.",
}


def list_networks() -> list[tuple[str, NetworkData, str]]:
    return [(name, _NETWORKS[name], _DESCRIPTIONS[name]) for name in _NETWORKS]


def get_network(name: str) -> NetworkData:
    if name not in _NETWORKS:
        raise KeyError(f"Unknown network '{name}'. Choose from {list(_NETWORKS)}")
    return _NETWORKS[name]
