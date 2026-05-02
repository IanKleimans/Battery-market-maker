import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLiveDispatch } from '../useLiveDispatch'
import { useSimulator } from '@/store/simulator'
import { api } from '@/api/client'

const initial = useSimulator.getState()

describe('useLiveDispatch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useSimulator.setState(initial, true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('debounces and only commits the latest result when responses arrive out of order', async () => {
    const calls: number[] = []
    let resolveFirst: (v: unknown) => void = () => {}
    let resolveSecond: (v: unknown) => void = () => {}
    const spy = vi.spyOn(api, 'singleperiodOPF').mockImplementation((req) => {
      const idx = calls.length
      calls.push(req.load_multiplier)
      return new Promise((resolve) => {
        if (idx === 0) resolveFirst = resolve as (v: unknown) => void
        else resolveSecond = resolve as (v: unknown) => void
      }) as ReturnType<typeof api.singleperiodOPF>
    })

    const { rerender } = renderHook(({ active }) => useLiveDispatch(active), {
      initialProps: { active: true },
    })

    // First slider change → first debounced fetch
    act(() => {
      useSimulator.getState().setLoadMultiplier(1.1)
      vi.advanceTimersByTime(150)
    })
    expect(spy).toHaveBeenCalledTimes(1)

    // Second slider change before first resolves → second fetch issued
    act(() => {
      useSimulator.getState().setLoadMultiplier(1.2)
      vi.advanceTimersByTime(150)
    })
    expect(spy).toHaveBeenCalledTimes(2)

    // Now second resolves first
    await act(async () => {
      resolveSecond({
        status: 'optimal',
        total_cost: 200,
        solve_time_seconds: 0.05,
        generator_output: {},
        line_flow: {},
        line_utilization: {},
        bus_lmp: {},
        bus_load: {},
      })
    })
    expect(useSimulator.getState().liveResult?.total_cost).toBe(200)

    // Then the first (stale) resolves — must NOT overwrite
    await act(async () => {
      resolveFirst({
        status: 'optimal',
        total_cost: 999,
        solve_time_seconds: 0.05,
        generator_output: {},
        line_flow: {},
        line_utilization: {},
        bus_lmp: {},
        bus_load: {},
      })
    })
    expect(useSimulator.getState().liveResult?.total_cost).toBe(200)

    rerender({ active: false })
  })

  it('passes an AbortSignal so older requests can be cancelled', () => {
    const spy = vi.spyOn(api, 'singleperiodOPF').mockImplementation(() =>
      new Promise(() => {}) as ReturnType<typeof api.singleperiodOPF>,
    )

    renderHook(() => useLiveDispatch(true))
    act(() => {
      useSimulator.getState().setLoadMultiplier(1.1)
      vi.advanceTimersByTime(150)
    })
    act(() => {
      useSimulator.getState().setLoadMultiplier(1.3)
      vi.advanceTimersByTime(150)
    })

    expect(spy).toHaveBeenCalledTimes(2)
    const firstSignal = spy.mock.calls[0]?.[1]?.signal
    expect(firstSignal).toBeDefined()
    expect(firstSignal?.aborted).toBe(true)
  })
})
