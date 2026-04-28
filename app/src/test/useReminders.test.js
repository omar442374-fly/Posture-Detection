import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useReminders from '../hooks/useReminders.js'

// Stub electronAPI on window
beforeEach(() => {
  vi.useFakeTimers()
  window.electronAPI = { sendNotification: vi.fn() }
})

afterEach(() => {
  vi.useRealTimers()
  delete window.electronAPI
})

describe('useReminders', () => {
  const baseSettings = {
    blinkIntervalMin: 1,
    waterIntervalMin: 2,
    notificationsEnabled: true
  }

  it('starts with no alerts', () => {
    const { result } = renderHook(() => useReminders(baseSettings))
    expect(result.current.alerts).toHaveLength(0)
  })

  it('fires a blink alert after the configured interval', () => {
    const { result } = renderHook(() => useReminders(baseSettings))

    act(() => { vi.advanceTimersByTime(60 * 1000) })   // 1 minute

    const blinkAlerts = result.current.alerts.filter(a => a.type === 'blink')
    expect(blinkAlerts).toHaveLength(1)
    expect(blinkAlerts[0].message).toMatch(/blink|eye/i)
  })

  it('fires a water alert after the configured interval', () => {
    const { result } = renderHook(() => useReminders(baseSettings))

    act(() => { vi.advanceTimersByTime(2 * 60 * 1000) }) // 2 minutes

    const waterAlerts = result.current.alerts.filter(a => a.type === 'water')
    expect(waterAlerts).toHaveLength(1)
    expect(waterAlerts[0].message).toMatch(/water|hydrat/i)
  })

  it('dismissAlert removes the alert by id', () => {
    const { result } = renderHook(() => useReminders(baseSettings))

    act(() => { vi.advanceTimersByTime(60 * 1000) })

    const { id } = result.current.alerts[0]
    act(() => { result.current.dismissAlert(id) })

    expect(result.current.alerts.find(a => a.id === id)).toBeUndefined()
  })

  it('replaces existing alert of same type instead of stacking', () => {
    const { result } = renderHook(() => useReminders(baseSettings))

    act(() => { vi.advanceTimersByTime(60 * 1000) })
    act(() => { vi.advanceTimersByTime(60 * 1000) })

    const blinkAlerts = result.current.alerts.filter(a => a.type === 'blink')
    expect(blinkAlerts).toHaveLength(1)
  })

  it('sends a system notification when electronAPI is available and enabled', () => {
    const { result: _ } = renderHook(() => useReminders(baseSettings))

    act(() => { vi.advanceTimersByTime(60 * 1000) })

    expect(window.electronAPI.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/blink/i) })
    )
  })

  it('does not send notification when notificationsEnabled is false', () => {
    const settings = { ...baseSettings, notificationsEnabled: false }
    renderHook(() => useReminders(settings))

    act(() => { vi.advanceTimersByTime(60 * 1000) })

    expect(window.electronAPI.sendNotification).not.toHaveBeenCalled()
  })
})
