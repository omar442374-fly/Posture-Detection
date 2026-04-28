import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import usePostureDetection from '../hooks/usePostureDetection.js'

beforeEach(() => {
  vi.useFakeTimers()
  // Stub fetch so health checks don't throw
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  window.electronAPI = { sendNotification: vi.fn() }
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete window.electronAPI
})

const baseSettings = {
  serverUrl: 'http://localhost:8765',
  postureAlertDelay: 0,   // alert immediately
  notificationsEnabled: true
}

function firePostureResult (label) {
  window.dispatchEvent(new CustomEvent('posture-result', {
    detail: { label, confidence: 0.9 }
  }))
}

describe('usePostureDetection', () => {
  it('starts with null postureState and empty alerts', () => {
    const { result } = renderHook(() => usePostureDetection(baseSettings))
    expect(result.current.postureState).toBeNull()
    expect(result.current.alerts).toHaveLength(0)
  })

  it('updates postureState on posture-result event', () => {
    const { result } = renderHook(() => usePostureDetection(baseSettings))

    act(() => { firePostureResult('good_posture') })

    expect(result.current.postureState).toMatchObject({ label: 'good_posture', confidence: 0.9 })
  })

  it('increments totalChecks for every received result', () => {
    const { result } = renderHook(() => usePostureDetection(baseSettings))

    act(() => { firePostureResult('good_posture') })
    act(() => { firePostureResult('good_posture') })
    // stats.totalChecks is derived from checksRef inside the 1-second interval
    act(() => { vi.advanceTimersByTime(1100) })

    expect(result.current.stats.totalChecks).toBe(2)
  })

  it('computes goodPosturePercent correctly', () => {
    const { result } = renderHook(() => usePostureDetection(baseSettings))

    act(() => { firePostureResult('good_posture') })
    act(() => { firePostureResult('good_posture') })
    act(() => { firePostureResult('bad_posture') })

    // Advance the 1-second stats timer
    act(() => { vi.advanceTimersByTime(1100) })

    expect(result.current.stats.goodPosturePercent).toBe(67)
  })

  it('creates a posture alert when bad posture exceeds delay', () => {
    const { result } = renderHook(() => usePostureDetection({ ...baseSettings, postureAlertDelay: 0 }))

    act(() => { firePostureResult('bad_posture') })

    const postureAlerts = result.current.alerts.filter(a => a.type === 'posture')
    expect(postureAlerts).toHaveLength(1)
  })

  it('clears posture alerts when good posture is detected', () => {
    const { result } = renderHook(() => usePostureDetection(baseSettings))

    act(() => { firePostureResult('bad_posture') })
    act(() => { firePostureResult('good_posture') })

    const postureAlerts = result.current.alerts.filter(a => a.type === 'posture')
    expect(postureAlerts).toHaveLength(0)
  })

  it('dismissAlert removes the alert', () => {
    const { result } = renderHook(() => usePostureDetection(baseSettings))

    act(() => { firePostureResult('bad_posture') })

    const { id } = result.current.alerts[0]
    act(() => { result.current.dismissAlert(id) })

    expect(result.current.alerts.find(a => a.id === id)).toBeUndefined()
  })

  it('sends a system notification on posture alert when enabled', () => {
    renderHook(() => usePostureDetection(baseSettings))

    act(() => { firePostureResult('bad_posture') })

    expect(window.electronAPI.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Posture Alert' })
    )
  })

  it('increments postureAlerts stat for each alert', () => {
    const { result } = renderHook(() => usePostureDetection(baseSettings))

    act(() => { firePostureResult('bad_posture') })

    act(() => { vi.advanceTimersByTime(1100) })

    expect(result.current.stats.postureAlerts).toBe(1)
  })
})
