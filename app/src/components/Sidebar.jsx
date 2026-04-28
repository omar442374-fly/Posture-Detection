import { useState } from 'react'
import styles from './Sidebar.module.css'
import { XIcon } from './Icons.jsx'

export default function Sidebar ({ open, settings, onClose, onSave }) {
  const [local, setLocal] = useState({ ...settings })

  const handleChange = (key, value) => {
    setLocal((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    onSave(local)
  }

  return (
    <>
      {open && (
        <div
          className={styles.overlay}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`${styles.sidebar} ${open ? styles.open : ''}`}
        aria-label="Settings panel"
        aria-hidden={!open}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.header}>
          <h2 className={styles.heading}>Settings</h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close settings"
          >
            <XIcon aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          <Section title="Reminders">
            <NumberField
              id="blink-interval"
              label="Blink reminder every"
              unit="min"
              min={1} max={60}
              value={local.blinkIntervalMin}
              onChange={(v) => handleChange('blinkIntervalMin', v)}
            />
            <NumberField
              id="water-interval"
              label="Water reminder every"
              unit="min"
              min={5} max={120}
              value={local.waterIntervalMin}
              onChange={(v) => handleChange('waterIntervalMin', v)}
            />
          </Section>

          <Section title="Posture Detection">
            <NumberField
              id="posture-delay"
              label="Alert after bad posture for"
              unit="sec"
              min={1} max={60}
              value={local.postureAlertDelay}
              onChange={(v) => handleChange('postureAlertDelay', v)}
            />
            <TextField
              id="server-url"
              label="Inference server URL"
              value={local.serverUrl}
              onChange={(v) => handleChange('serverUrl', v)}
            />
          </Section>

          <Section title="Notifications">
            <Toggle
              id="notif-enabled"
              label="System notifications"
              checked={local.notificationsEnabled}
              onChange={(v) => handleChange('notificationsEnabled', v)}
            />
          </Section>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>Save</button>
        </div>
      </aside>
    </>
  )
}

function Section ({ title, children }) {
  return (
    <fieldset className={styles.section}>
      <legend className={styles.sectionTitle}>{title}</legend>
      <div className={styles.fields}>{children}</div>
    </fieldset>
  )
}

function NumberField ({ id, label, unit, min, max, value, onChange }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <div className={styles.inputRow}>
        <input
          id={id}
          type="number"
          className={styles.input}
          min={min} max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-describedby={`${id}-unit`}
        />
        <span id={`${id}-unit`} className={styles.unit}>{unit}</span>
      </div>
    </div>
  )
}

function TextField ({ id, label, value, onChange }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function Toggle ({ id, label, checked, onChange }) {
  return (
    <div className={styles.toggleRow}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
        onClick={() => onChange(!checked)}
        aria-label={label}
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
  )
}
