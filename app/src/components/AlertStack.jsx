import { useEffect } from 'react'
import styles from './AlertStack.module.css'
import { XIcon, AlertTriangleIcon, EyeIcon, DropletIcon } from './Icons.jsx'

const ALERT_ICONS = {
  posture: AlertTriangleIcon,
  blink:   EyeIcon,
  water:   DropletIcon
}

const ALERT_LABELS = {
  posture: 'Posture',
  blink:   'Eye Care',
  water:   'Hydration'
}

export default function AlertStack ({ alerts, onDismiss }) {
  // Auto-dismiss reminder alerts after 8 seconds
  useEffect(() => {
    const timers = alerts
      .filter((a) => a.type !== 'posture' && !a.persistent)
      .map((a) =>
        setTimeout(() => onDismiss(a.id), 8000)
      )
    return () => timers.forEach(clearTimeout)
  }, [alerts, onDismiss])

  if (alerts.length === 0) return null

  return (
    <div
      className={styles.stack}
      role="log"
      aria-label="Alerts and reminders"
      aria-live="polite"
      aria-atomic="false"
      aria-relevant="additions"
    >
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onDismiss={() => onDismiss(alert.id)}
        />
      ))}
    </div>
  )
}

function AlertCard ({ alert, onDismiss }) {
  const Icon = ALERT_ICONS[alert.type] ?? AlertTriangleIcon
  const typeLabel = ALERT_LABELS[alert.type] ?? 'Alert'

  return (
    <div
      className={`${styles.card} ${styles[`type_${alert.type}`]}`}
      role="alert"
      aria-label={`${typeLabel}: ${alert.message}`}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.content}>
        <span className={styles.typeLabel}>{typeLabel}</span>
        <p className={styles.message}>{alert.message}</p>
      </div>
      <button
        className={styles.dismiss}
        onClick={onDismiss}
        aria-label={`Dismiss ${typeLabel} alert`}
        title="Dismiss"
      >
        <XIcon aria-hidden="true" />
      </button>
    </div>
  )
}
