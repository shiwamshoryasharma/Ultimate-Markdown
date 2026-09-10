import { useEffect, useState } from 'react'

export type ViewportClass = 'mobile' | 'tablet' | 'desktop'

function classify(width: number): ViewportClass {
  if (width < 720) return 'mobile'
  if (width < 1080) return 'tablet'
  return 'desktop'
}

/** Drives the workspace's responsive layout: desktop keeps all panels inline, tablet collapses the explorer to a drawer, mobile switches to Files/Edit/Preview tabs. */
export function useViewport(): ViewportClass {
  const [viewport, setViewport] = useState<ViewportClass>(() =>
    typeof window === 'undefined' ? 'desktop' : classify(window.innerWidth),
  )

  useEffect(() => {
    const onResize = () => setViewport(classify(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return viewport
}
