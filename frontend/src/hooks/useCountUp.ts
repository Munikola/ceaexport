import { useEffect, useState, useRef } from 'react'

/**
 * Anima un número de 0 (o desde el valor anterior) hasta `end` en `duration` ms.
 * Usa easing cubic-out para una sensación premium (rápido al principio, lento al final).
 *
 * Si `disabled=true`, devuelve el valor final inmediatamente (útil cuando el dato
 * todavía no está cargado).
 */
export function useCountUp(end: number, duration = 800, disabled = false): number {
  const [count, setCount] = useState(0)
  const prevEnd = useRef(0)

  useEffect(() => {
    if (disabled || !isFinite(end)) {
      setCount(end)
      prevEnd.current = end
      return
    }
    const from = prevEnd.current
    const startTime = performance.now()
    let frameId: number

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Easing cubic-out: 1 - (1-t)^3
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(from + (end - from) * eased)
      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      } else {
        setCount(end)
        prevEnd.current = end
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [end, duration, disabled])

  return count
}
