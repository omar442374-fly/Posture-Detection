import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useReminders
 * Manages periodic blink and water reminders.
 */
export default function useReminders (settings) {
  const [alerts, setAlerts] = useState([])
  const blinkTimerRef = useRef(null)
  const waterTimerRef = useRef(null)

  const addAlert = useCallback((type, message) => {
    const id = `${type}-${Date.now()}`
    setAlerts((prev) => [
      // remove existing alert of same type so we don't stack them
      ...prev.filter((a) => a.type !== type),
      { id, type, message, persistent: false }
    ])

    if (window.electronAPI && settings.notificationsEnabled) {
      const titles = { blink: 'Blink Reminder 👁️', water: 'Hydration Reminder 💧' }
      window.electronAPI.sendNotification({
        title: titles[type] ?? 'Reminder',
        body: message
      })
    }
  }, [settings.notificationsEnabled])

  // Blink reminder
  useEffect(() => {
    const intervalMs = settings.blinkIntervalMin * 60 * 1000

    blinkTimerRef.current = setInterval(() => {
      const messages = [
        'Time to blink! 👁️ Close your eyes for a moment.',
        'Blink reminder: Give your eyes a quick rest.',
        "20-20-20 rule: Look 20 ft away for 20 seconds to reduce eye strain.",
        'Your eyes need a break — blink slowly a few times.'
      ]
      addAlert('blink', messages[Math.floor(Math.random() * messages.length)])
    }, intervalMs)

    return () => clearInterval(blinkTimerRef.current)
  }, [settings.blinkIntervalMin, addAlert])

  // Water reminder
  useEffect(() => {
    const intervalMs = settings.waterIntervalMin * 60 * 1000

    waterTimerRef.current = setInterval(() => {
      const messages = [
        'Time to drink water! 💧 Stay hydrated.',
        'Hydration check: Have you had water recently?',
        'Drink a glass of water — your body will thank you.',
        'Reminder: Keep that water bottle nearby and take a sip!'
      ]
      addAlert('water', messages[Math.floor(Math.random() * messages.length)])
    }, intervalMs)

    return () => clearInterval(waterTimerRef.current)
  }, [settings.waterIntervalMin, addAlert])

  const dismissAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return { alerts, dismissAlert }
}
