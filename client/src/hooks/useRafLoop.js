import { useRef, useEffect } from 'react'

export default function useRafLoop(callback) {
  const cbRef = useRef(callback)
  useEffect(() => { cbRef.current = callback }, [callback])

  useEffect(() => {
    let raf = null
    let active = true
    const loop = (t) => {
      if (!active) return
      cbRef.current(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { active = false; raf && cancelAnimationFrame(raf) }
  }, [])
}