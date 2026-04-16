export function distance2D(a, b) {
  const dx = (a.x - b.x)
  const dy = (a.y - b.y)
  return Math.sqrt(dx*dx + dy*dy)
}

export function vel2D(current, prev, dt = 1/60) {
  if (!prev) return { x: 0, y: 0 }
  return { x: (current.x - prev.x) / dt, y: (current.y - prev.y) / dt }
}