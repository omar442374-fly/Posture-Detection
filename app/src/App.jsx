import { useState, useCallback } from 'react'
import Header from './components/Header.jsx'
import CameraFeed from './components/CameraFeed.jsx'
import PostureStatus from './components/PostureStatus.jsx'
import AlertStack from './components/AlertStack.jsx'
import Sidebar from './components/Sidebar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import usePostureDetection from './hooks/usePostureDetection.js'
import useReminders from './hooks/useReminders.js'
import styles from './App.module.css'

const SETTINGS_KEY = 'posture-detection-settings'

const DEFAULT_SETTINGS = {
  blinkIntervalMin: 20,
  waterIntervalMin: 30,
  postureAlertDelay: 5,
  serverUrl: 'http://localhost:8765',
  notificationsEnabled: true
}

function loadSettings () {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export default function App () {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settings, setSettings] = useState(loadSettings)

  const {
    postureState,
    alerts: postureAlerts,
    stats,
    dismissAlert: dismissPostureAlert
  } = usePostureDetection(settings)

  const { alerts: reminderAlerts, dismissAlert: dismissReminderAlert } = useReminders(settings)

  const allAlerts = [...postureAlerts, ...reminderAlerts]

  const handleDismiss = useCallback((id) => {
    dismissPostureAlert(id)
    dismissReminderAlert(id)
  }, [dismissPostureAlert, dismissReminderAlert])

  const handleSaveSettings = useCallback((s) => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* storage unavailable */ }
    setSettings(s)
    setSidebarOpen(false)
  }, [])

  return (
    <ErrorBoundary>
      <div className={styles.app} aria-label="Posture Detection Application">
        <Header onOpenSettings={() => setSidebarOpen(true)} stats={stats} />

        <main className={styles.main}>
          <div className={styles.cameraSection}>
            <CameraFeed
              postureState={postureState}
              serverUrl={settings.serverUrl}
            />
          </div>

          <div className={styles.statusSection}>
            <PostureStatus postureState={postureState} stats={stats} />
          </div>
        </main>

        <AlertStack alerts={allAlerts} onDismiss={handleDismiss} />

        <Sidebar
          open={sidebarOpen}
          settings={settings}
          onClose={() => setSidebarOpen(false)}
          onSave={handleSaveSettings}
        />
      </div>
    </ErrorBoundary>
  )
}
