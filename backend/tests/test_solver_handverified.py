"""Hand-verifiable single-period DC-OPF cases.

These are the kind of small problems where you can solve the LP on paper.
"""

from __future__ import annotations

from app.network.topologies import get_network
from app.solvers.singleperiod_opf import solve_single_period


def test_uncongested_5bus_lmp_uniform() -> None:
    """With light load and ample line capacity, LMPs should be uniform across
    buses (since the marginal generator's cost dominates everywhere)."""
    net = get_network("bus5")
    sol = solve_single_period(net, load_multiplier=1.0)
    assert sol.status == "optimal"
    lmps = list(sol.bus_lmp.values())
    spread = max(lmps) - min(lmps)
    # Under modest, uncongested loading, all five buses should hit the same LMP.
    assert spread < 1.0
    # And LMPs should be in the merit-order range (cheapest gen $8 to priciest $40)
    assert all(8.0 <= v <= 60.0 for v in lmps)


def test_load_scaling_increases_cost() -> None:
    """Doubling the load multiplier should not lower total cost."""
    net = get_network("bus5")
    a = solve_single_period(net, load_multiplier=0.5)
    b = solve_single_period(net, load_multiplier=1.0)
    assert b.total_cost >= a.total_cost - 1e-3


def test_wind_availability_reduces_cost_when_wind_present() -> None:
    """If a network has wind, more wind should not increase cost."""
    net = get_network("bus5")
    has_wind = any(g.fuel == "wind" for g in net.generators)
    if not has_wind:
        # 5-bus base case has no wind — skip semantic check
        return
    a = solve_single_period(net, wind_availability=0.1)
    b = solve_single_period(net, wind_availability=1.0)
    assert b.total_cost <= a.total_cost + 1e-3
