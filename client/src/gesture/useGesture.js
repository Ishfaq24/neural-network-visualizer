import { useRef, useEffect, useState } from 'react'
import { Hands } from '@mediapipe/hands'
import { isPinch, isOpenPalm, isGrab } from './gestureClassifier'
import { vel2D } from '../utils/vec'

export default function useGesture(videoRef, opts = {}) {
  const [landmarks, setLandmarks] = useState(null)
  const [gesture, setGesture] = useState(null)
  const [confidence, setConfidence] = useState(0)
  const prevLandmarksRef = useRef(null)
  const holdStartRef = useRef(null)
  const handsRef = useRef(null)
  const rafRef = useRef(null)
  const waitingRef = useRef(false)

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    })
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    })

    hands.onResults((results) => {
      const pts = (results.multiHandLandmarks && results.multiHandLandmarks[0]) || null
      // expose to debug global
      if (typeof window !== 'undefined') {
        window.__lastHandsResults = results
        window.__latestLandmarkCount = pts ? pts.length : 0
      }
      setLandmarks(pts)
      if (!pts) {
        setGesture(null)
        setConfidence(0)
        prevLandmarksRef.current = null
        holdStartRef.current = null
        if (typeof window !== 'undefined') window.__latestGesture = null
        return
      }

      const now = Date.now()
      const prev = prevLandmarksRef.current
      const vel = prev ? vel2D(pts[8], prev[8], 1/60) : { x: 0, y: 0 }
      const speed = Math.hypot(vel.x, vel.y)

      let g = null
      let conf = 0
      if (isPinch(pts)) {
        if (!holdStartRef.current) holdStartRef.current = now
        const held = now - holdStartRef.current > 400
        if (held) { g = 'hold'; conf = 0.9 } else { g = 'pinch'; conf = 0.95 }
      } else if (isGrab(pts)) { g = 'grab'; conf = 0.9; holdStartRef.current = null }
      else if (isOpenPalm(pts)) { g = 'openPalm'; conf = 0.9; holdStartRef.current = null }
      else if (speed > 1.6) { g = 'swipe'; conf = 0.85; holdStartRef.current = null }
      else if (speed > 0.02) { g = 'drag'; conf = 0.6; holdStartRef.current = null }
      else { g = null; conf = 0.1; holdStartRef.current = null }

      setGesture(g)
      setConfidence(conf)
      prevLandmarksRef.current = pts.map(p => ({ ...p }))
      if (typeof window !== 'undefined') window.__latestGesture = { landmarks: pts, gesture: g, confidence: conf }
    })

    handsRef.current = hands
    if (typeof window !== 'undefined') window.__handsInitialized = true

    // frame loop - start only once video has a srcObject
    let active = true
    async function frameLoop() {
      try {
        if (!active) return
        const video = videoRef.current
        if (video && video.srcObject && video.readyState >= 2) {
          await hands.send({ image: video })
        }
      } catch (err) {
        console.warn('MediaPipe hands send error', err)
      } finally {
        rafRef.current = requestAnimationFrame(frameLoop)
      }
    }

    async function waitAndStart() {
      if (waitingRef.current) return
      waitingRef.current = true
      const deadline = Date.now() + 8000
      while (active && (!videoRef.current || !videoRef.current.srcObject) && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 150))
      }
      frameLoop()
    }
    waitAndStart()

    return () => {
      active = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (handsRef.current) {
        try { handsRef.current.close() } catch (e) {}
        handsRef.current = null
      }
      waitingRef.current = false
      if (typeof window !== 'undefined') window.__latestGesture = null
    }
  }, [videoRef])

  return { landmarks, gesture, confidence }
}