import React, { useRef, useEffect, useState } from 'react'
import { getSharedCameraStream } from '../utils/cameraManager.js'

export default function CameraFeed() {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    async function start() {
      try {
        const stream = await getSharedCameraStream()
        if (!mounted) return
        if (videoRef.current) {
          if (videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream
            // annotate global debug helper
            if (typeof window !== 'undefined') window.__gestureVideoUI = videoRef.current
            try { await videoRef.current.play() } catch (e) { /* autoplay may be restricted */ }
          }
        }
      } catch (err) {
        console.error('Camera start error', err)
        setError(err.message || String(err))
      }
    }
    start()
    return () => { mounted = false }
  }, [])

  return (
    <div className="camera-card">
      <div className="text-sm mb-2 text-slate-200">Camera (gesture tracking)</div>
      <video
        ref={videoRef}
        className="w-full rounded-lg bg-black"
        playsInline
        muted
        autoPlay
      />
      {error && <div className="text-rose-400 text-xs mt-2">Camera error: {error}</div>}
    </div>
  )
}