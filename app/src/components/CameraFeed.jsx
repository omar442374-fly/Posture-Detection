import { useEffect, useRef, useCallback } from 'react'
import styles from './CameraFeed.module.css'
import { CameraOffIcon } from './Icons.jsx'

const INFERENCE_INTERVAL_MS = 500   // send frame every 500ms

export default function CameraFeed ({ postureState, serverUrl }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        scheduleInference()
      }
    } catch (err) {
      console.error('Camera error:', err)
    }
  }, [serverUrl])

  const scheduleInference = useCallback(() => {
    timerRef.current = setInterval(() => {
      captureAndSend()
    }, INFERENCE_INTERVAL_MS)
  }, [serverUrl])

  const captureAndSend = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      try {
        const formData = new FormData()
        formData.append('frame', blob, 'frame.jpg')
        const res = await fetch(`${serverUrl}/predict`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        })
        if (!res.ok) return
        const data = await res.json()
        drawOverlay(data)
        // Publish result so usePostureDetection hook can react
        window.dispatchEvent(new CustomEvent('posture-result', { detail: data }))
      } catch {
        // server not yet running or timeout — silently skip
      } finally {
        clearTimeout(timeoutId)
      }
    }, 'image/jpeg', 0.8)
  }, [serverUrl, drawOverlay])

  const drawOverlay = useCallback((data) => {
    const overlay = overlayRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    overlay.width = videoRef.current?.videoWidth ?? 640
    overlay.height = videoRef.current?.videoHeight ?? 480
    ctx.clearRect(0, 0, overlay.width, overlay.height)

    if (data.keypoints) {
      ctx.strokeStyle = data.label === 'good_posture' ? '#2dd4bf' : '#f87171'
      ctx.lineWidth = 3
      ctx.fillStyle = ctx.strokeStyle
      for (const kp of data.keypoints) {
        ctx.beginPath()
        ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [])

  useEffect(() => {
    startCamera()
    return () => {
      clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [startCamera])

  const isGood = postureState?.label === 'good_posture'
  const isDetecting = postureState !== null
  const borderClass = !isDetecting
    ? styles.borderIdle
    : isGood
    ? styles.borderGood
    : styles.borderBad

  return (
    <div
      className={`${styles.wrapper} ${borderClass}`}
      role="region"
      aria-label="Live camera feed with posture detection"
    >
      <video
        ref={videoRef}
        className={styles.video}
        autoPlay
        playsInline
        muted
        aria-label="Camera feed"
      />
      <canvas ref={canvasRef} className={styles.hidden} aria-hidden="true" />
      <canvas
        ref={overlayRef}
        className={styles.overlay}
        aria-hidden="true"
      />

      {!isDetecting && (
        <div className={styles.placeholder} aria-live="polite">
          <CameraOffIcon className={styles.placeholderIcon} aria-hidden="true" />
          <p>Connecting to inference server…</p>
          <p className={styles.placeholderSub}>
            Make sure the Python server is running
          </p>
        </div>
      )}

      <div
        className={styles.statusPill}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span
          className={`${styles.statusDot} ${isGood ? styles.dotGood : styles.dotBad}`}
          aria-hidden="true"
        />
        {isDetecting
          ? isGood ? 'Good posture' : 'Posture alert!'
          : 'Initialising…'}
      </div>
    </div>
  )
}
