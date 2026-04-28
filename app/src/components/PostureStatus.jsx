import styles from './PostureStatus.module.css'
import { CheckCircleIcon, AlertTriangleIcon, ActivityIcon } from './Icons.jsx'

export default function PostureStatus ({ postureState, stats }) {
  const isGood = postureState?.label === 'good_posture'
  const confidence = postureState?.confidence ?? null

  return (
    <section className={styles.card} aria-labelledby="posture-status-heading">
      <h2 id="posture-status-heading" className={styles.heading}>
        Posture Status
      </h2>

      <div
        className={`${styles.statusBadge} ${isGood ? styles.good : styles.bad}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isGood
          ? <CheckCircleIcon className={styles.icon} aria-hidden="true" />
          : <AlertTriangleIcon className={styles.icon} aria-hidden="true" />}
        <span className={styles.label}>
          {postureState === null ? 'Detecting…' : isGood ? 'Good Posture' : 'Bad Posture'}
        </span>
      </div>

      {confidence !== null && (
        <div className={styles.confidence} aria-label={`Confidence: ${Math.round(confidence * 100)}%`}>
          <span className={styles.confLabel}>Confidence</span>
          <div className={styles.confBar} role="progressbar"
            aria-valuenow={Math.round(confidence * 100)}
            aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`${styles.confFill} ${isGood ? styles.fillGood : styles.fillBad}`}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
          <span className={styles.confValue}>{Math.round(confidence * 100)}%</span>
        </div>
      )}

      <div className={styles.statsGrid} aria-label="Session statistics">
        <StatTile
          icon={<ActivityIcon aria-hidden="true" />}
          label="Good posture"
          value={`${stats?.goodPosturePercent ?? 0}%`}
          accent={stats?.goodPosturePercent >= 80 ? 'success' : 'warning'}
        />
        <StatTile
          icon={<AlertTriangleIcon aria-hidden="true" />}
          label="Posture alerts"
          value={String(stats?.postureAlerts ?? 0)}
          accent="danger"
        />
        <StatTile
          icon={<ActivityIcon aria-hidden="true" />}
          label="Session"
          value={formatTime(stats?.sessionMinutes ?? 0)}
          accent="info"
        />
        <StatTile
          icon={<CheckCircleIcon aria-hidden="true" />}
          label="Checks done"
          value={String(stats?.totalChecks ?? 0)}
          accent="brand"
        />
      </div>

      <div className={styles.tips} aria-labelledby="posture-tips-heading">
        <h3 id="posture-tips-heading" className={styles.tipsHeading}>
          Posture Tips
        </h3>
        <ul className={styles.tipsList}>
          <li>Keep your back straight and supported</li>
          <li>Screen at eye level, ~50–70 cm away</li>
          <li>Feet flat on the floor</li>
          <li>Shoulders relaxed, elbows at ~90°</li>
          <li>Take a short stand-up break every hour</li>
        </ul>
      </div>
    </section>
  )
}

function StatTile ({ icon, label, value, accent }) {
  return (
    <div className={`${styles.statTile} ${styles[`accent_${accent}`]}`}
      aria-label={`${label}: ${value}`}>
      <span className={styles.tileIcon}>{icon}</span>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  )
}

function formatTime (minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
