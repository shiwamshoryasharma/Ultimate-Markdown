import { useCallback, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import styles from './Resizer.module.css'

interface ResizerProps {
  onResize: (deltaX: number) => void
  ariaLabel: string
}

/** A thin draggable vertical divider between two panels. Reports pixel deltas; the caller owns the actual width state. */
export function Resizer({ onResize, ariaLabel }: ResizerProps) {
  const lastX = useRef(0)

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      lastX.current = event.clientX

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - lastX.current
        lastX.current = moveEvent.clientX
        onResize(delta)
      }
      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
    [onResize],
  )

  return (
    <div
      className={styles.resizer}
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
    >
      <div className={styles.grip} />
    </div>
  )
}
