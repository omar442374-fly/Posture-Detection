import styles from './Header.module.css'
import { SettingsIcon, MonitorIcon } from './Icons.jsx'

export default function Header ({ onOpenSettings, stats }) {
  const sessionTime = stats?.sessionMinutes ?? 0
  const hours = Math.floor(sessionTime / 60)
  const mins = sessionTime % 60
  const sessionLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  return (
    <header className={styles.header} role="banner">
      <div className={styles.brand}>
        <MonitorIcon className={styles.logo} aria-hidden="true" />
        <div>
          <span className={styles.title}>Posture Detection</span>
          <span className={styles.subtitle}>Stay healthy at your desk</span>
        </div>
      </div>

      <div className={styles.meta} aria-label="Session statistics">
        <Stat label="Session" value={sessionLabel} />
        <Stat
          label="Good posture"
          value={`${stats?.goodPosturePercent ?? 0}%`}
          highlight={stats?.goodPosturePercent >= 80}
        />
        <Stat label="Alerts" value={String(stats?.totalAlerts ?? 0)} />
      </div>

      <button
        className={styles.settingsBtn}
        onClick={onOpenSettings}
        aria-label="Open settings"
        title="Settings"
      >
        <SettingsIcon aria-hidden="true" />
      </button>
    </header>
  )
}

function Stat ({ label, value, highlight }) {
  return (
    <div className={styles.stat} aria-label={`${label}: ${value}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${highlight ? styles.statHighlight : ''}`}>
        {value}
      </span>
    </div>
  )
}
