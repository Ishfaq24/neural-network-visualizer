let sharedStream = null
let acquiring = null

export async function getSharedCameraStream(constraints = { video: { width: 640, height: 480, facingMode: 'user' }, audio: false }) {
  if (sharedStream) return sharedStream
  if (acquiring) return acquiring
  acquiring = (async () => {
    try {
      sharedStream = await navigator.mediaDevices.getUserMedia(constraints)
      // mark for debug
      if (typeof window !== 'undefined') window.__sharedStreamActive = true
      return sharedStream
    } finally {
      acquiring = null
    }
  })()
  return acquiring
}

export function stopSharedCameraStream() {
  if (!sharedStream) return
  sharedStream.getTracks().forEach(t => t.stop())
  sharedStream = null
  if (typeof window !== 'undefined') window.__sharedStreamActive = false
}