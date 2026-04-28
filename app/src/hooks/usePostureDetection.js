import { useState, useEffect, useRef, useCallback } from 'react'

const POLL_INTERVAL_MS = 500
const HEALTH_CHECK_INTERVAL_MS = 5000

/**
 * usePostureDetection
 * Polls the inference server and maintains posture state + stats.
 * The actual frame capture happens in CameraFeed.jsx; this hook
 * manages the *state* derived from inference responses.
 */
export default function usePostureDetection (settings) {
  const [postureState, setPostureState] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState({
    sessionMinutes: 0,
    goodPosturePercent: 0,
    totalAlerts: 0,
    postureAlerts: 0,
    totalChecks: 0
  })

  const badPostureStartRef = useRef(null)
  const checksRef = useRef({ total: 0, good: 0 })
  const alertCountRef = useRef(0)
  const sessionStartRef = useRef(Date.now())
  const serverUrl = settings.serverUrl
  const alertDelayMs = settings.postureAlertDelay * 1000

  // Update stats every second
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 60000)
      const { total, good } = checksRef.current
      setStats((prev) => ({
        ...prev,
        sessionMinutes: elapsed,
        goodPosturePercent: total > 0 ? Math.round((good / total) * 100) : 0,
        totalChecks: total
      }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Health-check the server periodically
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      try {
        const res = await fetch(`${serverUrl}/health`, { signal: controller.signal })
        if (!res.ok) throw new Error('unhealthy')
        // server is alive — if no posture state yet, set to null to keep
        // CameraFeed in "connecting" state
      } catch {
        if (!cancelled) setPostureState(null)
      } finally {
        clearTimeout(timeoutId)
      }
    }
    check()
    const timer = setInterval(check, HEALTH_CHECK_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [serverUrl])

  // Receive posture results published via a custom event from CameraFeed
  useEffect(() => {
    const handler = (e) => {
      const data = e.detail
      if (!data || !data.label) return

      setPostureState(data)
      checksRef.current.total += 1

      if (data.label === 'good_posture') {
        checksRef.current.good += 1
        badPostureStartRef.current = null
        // clear posture alerts
        setAlerts((prev) => prev.filter((a) => a.type !== 'posture'))
      } else {
        if (!badPostureStartRef.current) {
          badPostureStartRef.current = Date.now()
        }
        const badDuration = Date.now() - badPostureStartRef.current
        if (badDuration >= alertDelayMs) {
          triggerPostureAlert(data)
          badPostureStartRef.current = Date.now() // reset timer to avoid spamming
        }
      }
    }

    window.addEventListener('posture-result', handler)
    return () => window.removeEventListener('posture-result', handler)
  }, [alertDelayMs])

  const triggerPostureAlert = useCallback((data) => {
    const id = `posture-${Date.now()}`
    alertCountRef.current += 1

    const messages = [
      'Please sit up straight!',
      'Check your posture — back straight, shoulders relaxed.',
      'Your posture needs attention. Adjust your sitting position.',
      'Time to fix your posture! Shoulders back, spine neutral.'
    ]
    const message = messages[Math.floor(Math.random() * messages.length)]

    setAlerts((prev) => [
      { id, type: 'posture', message, persistent: true },
      ...prev.filter((a) => a.type !== 'posture')
    ])
    setStats((prev) => ({
      ...prev,
      totalAlerts: prev.totalAlerts + 1,
      postureAlerts: prev.postureAlerts + 1
    }))

    // System notification
    if (window.electronAPI && settings.notificationsEnabled) {
      window.electronAPI.sendNotification({ title: 'Posture Alert', body: message })
    }
  }, [settings.notificationsEnabled])

  const dismissAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return { postureState, alerts, stats, dismissAlert }
}
