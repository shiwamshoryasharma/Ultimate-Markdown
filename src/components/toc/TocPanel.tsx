import { useEffect, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import { List as ListIcon } from 'lucide-react'
import clsx from 'clsx'
import { EmptyState } from '@/components/common/EmptyState'
import { extractHeadings } from '@/services/markdown/extractHeadings'
import styles from './TocPanel.module.css'

interface TocPanelProps {
  content: string
  scrollContainerRef: RefObject<HTMLElement | null>
}

export function TocPanel({ content, scrollContainerRef }: TocPanelProps) {
  const headings = useMemo(() => extractHeadings(content), [content])
  const [activeSlug, setActiveSlug] = useState<string | null>(null)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || headings.length === 0) return

    let ticking = false
    const updateActive = () => {
      ticking = false
      const containerTop = container.getBoundingClientRect().top
      let current: string | null = null
      for (const heading of headings) {
        const el = container.querySelector(`#${CSS.escape(heading.slug)}`)
        if (!el) continue
        const top = el.getBoundingClientRect().top - containerTop
        if (top <= 80) current = heading.slug
        else break
      }
      setActiveSlug(current ?? headings[0]?.slug ?? null)
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(updateActive)
    }

    updateActive()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [headings, scrollContainerRef])

  if (headings.length === 0) {
    return (
      <EmptyState
        icon={<ListIcon />}
        title="No headings yet"
        description="Add # headings to your document to see them here."
      />
    )
  }

  const minLevel = Math.min(...headings.map((heading) => heading.level))

  const handleClick = (slug: string) => {
    const container = scrollContainerRef.current
    const el = container?.querySelector(`#${CSS.escape(slug)}`)
    el?.scrollIntoView({ behavior: (document.documentElement.dataset.reducedMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <nav className={styles.panel} aria-label="Table of contents">
      <ul className={styles.list}>
        {headings.map((heading, index) => (
          <li key={`${heading.slug}-${index}`}>
            <button
              type="button"
              className={clsx(styles.item, heading.slug === activeSlug && styles.active)}
              style={{ paddingLeft: 12 + (heading.level - minLevel) * 14 }}
              onClick={() => handleClick(heading.slug)}
              title={heading.text}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
