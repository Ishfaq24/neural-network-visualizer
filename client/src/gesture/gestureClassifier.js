// Helper functions to detect gestures from MediaPipe landmarks.
// Landmarks: array of 21 points {x,y,z} (normalized 0..1).
// We'll implement: pinch, openPalm, grab (closed), swipe (by velocity), hold (time-based)

import { distance2D } from '../utils/vec'

export function isPinch(landmarks, threshold = 0.04) {
  // thumb tip index: 4 and 8
  if (!landmarks) return false
  const a = landmarks[4]
  const b = landmarks[8]
  return distance2D(a, b) < threshold
}

export function isOpenPalm(landmarks, angleThreshold = 0.8) {
  // approximate: check distance between fingertips and wrist
  if (!landmarks) return false
  const wrist = landmarks[0]
  const tips = [8, 12, 16, 20].map(i => landmarks[i])
  // normalized distances average
  const avg = tips.reduce((s, t) => s + distance2D(wrist, t), 0) / tips.length
  return avg > 0.35 // tuned heuristic for open palm (normalized coordinates)
}

export function isGrab(landmarks) {
  // closed fist: fingertip distances to wrist small
  if (!landmarks) return false
  const wrist = landmarks[0]
  const tips = [8, 12, 16, 20].map(i => landmarks[i])
  const avg = tips.reduce((s, t) => s + distance2D(wrist, t), 0) / tips.length
  return avg < 0.18
}