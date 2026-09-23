import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import styles from './BackToTop.module.css'

/** Scroll the containing reader, including panes that scroll independently. */
export function BackToTop() {
  const marker = useRef<HTMLSpanElement>(null)
  const scroller = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let parent = marker.current?.parentElement ?? null
    while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement
    const target = parent ?? document.documentElement
    scroller.current = target
    const events = parent ?? window
    const update = () => setVisible(target.scrollTop > 300)
    events.addEventListener('scroll', update, { passive: true })
    update()
    return () => events.removeEventListener('scroll', update)
  }, [])
  return <><span ref={marker} aria-hidden="true" />{visible && <button type="button" className={styles.button} onClick={() => scroller.current?.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><ArrowUp size={17} aria-hidden="true" />Back to top</button>}</>
}
