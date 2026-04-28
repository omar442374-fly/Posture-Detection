import { useEffect, useRef, useCallback, useState } from 'react'
import styles from './CameraFeed.module.css'
import { CameraOffIcon } from './Icons.jsx'

const INFERENCE_INTERVAL_MS = 500   // send frame every 500ms
const FETCH_TIMEOUT_MS = 2000       // abort inference request after this many ms

export default function CameraFeed ({ postureState, serverUrl }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  // Keep a ref to serverUrl so capture callbacks always use the latest value
  // without needing to restart the camera/interval on every URL change
  const serverUrlRef = useRef(serverUrl)
  useEffect(() => { serverUrlRef.current = serverUrl }, [serverUrl])

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
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const formData = new FormData()
        formData.append('frame', blob, 'frame.jpg')
        const res = await fetch(`${serverUrlRef.current}/predict`, {
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
  }, [drawOverlay])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCameraReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
        timerRef.current = setInterval(captureAndSend, INFERENCE_INTERVAL_MS)
      }
    } catch (err) {
      console.error('Camera error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access denied. Please allow camera permissions and try again.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found. Please connect a webcam and try again.')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is in use by another application. Close it and try again.')
      } else {
        setCameraError(`Could not start camera: ${err.message}`)
      }
    }
  }, [captureAndSend])

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
  const borderClass = !cameraReady || !isDetecting
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

      {/* Camera failed — show error with retry */}
      {cameraError && (
        <div className={styles.placeholder} aria-live="polite">
          <CameraOffIcon className={styles.placeholderIcon} aria-hidden="true" />
          <p>{cameraError}</p>
          <button
            className={styles.retryBtn}
            onClick={startCamera}
            aria-label="Retry camera access"
          >
            Retry
          </button>
        </div>
      )}

      {/* Camera not yet started (no error) */}
      {!cameraReady && !cameraError && (
        <div className={styles.placeholder} aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <p>Starting camera…</p>
        </div>
      )}

      {/* Camera running but server not yet connected */}
      {cameraReady && !isDetecting && (
        <div className={styles.serverBanner} aria-live="polite">
          <span>Connecting to inference server…</span>
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
        {!cameraReady
          ? cameraError ? 'Camera error' : 'Starting…'
          : isDetecting
          ? isGood ? 'Good posture' : 'Posture alert!'
          : 'Waiting for server…'}
      </div>
    </div>
  )
}
