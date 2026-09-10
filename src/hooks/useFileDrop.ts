import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'

interface FileDropHandlers {
  onDragEnter: (event: DragEvent) => void
  onDragLeave: (event: DragEvent) => void
  onDragOver: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
}

/** Shared drag-and-drop plumbing (enter/leave counter so nested children don't flicker the overlay, drop delegates to the caller). Used on both the Home screen and the workspace. */
export function useFileDrop(onDrop: (dataTransfer: DataTransfer) => void | Promise<void>): {
  dragActive: boolean
  dragHandlers: FileDropHandlers
} {
  const [active, setActive] = useState(false)
  const counter = useRef(0)
  const onDropRef = useRef(onDrop)
  useEffect(() => {
    onDropRef.current = onDrop
  }, [onDrop])

  const onDragEnter = useCallback((event: DragEvent) => {
    event.preventDefault()
    counter.current += 1
    if (event.dataTransfer.types.includes('Files')) setActive(true)
  }, [])

  const onDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault()
    counter.current -= 1
    if (counter.current <= 0) {
      counter.current = 0
      setActive(false)
    }
  }, [])

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
  }, [])

  const onDropHandler = useCallback((event: DragEvent) => {
    event.preventDefault()
    counter.current = 0
    setActive(false)
    void onDropRef.current(event.dataTransfer)
  }, [])

  return { dragActive: active, dragHandlers: { onDragEnter, onDragLeave, onDragOver, onDrop: onDropHandler } }
}
