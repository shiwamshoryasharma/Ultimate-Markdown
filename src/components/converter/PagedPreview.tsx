import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Layers } from 'lucide-react'
import type { ConversionSettings } from '@/types/conversion'
import { pageDimensions } from '@/types/conversion'
import type { ExportModel } from '@/services/conversion/model'
import { paginate } from '@/services/conversion/pagination'
import styles from './PagedPreview.module.css'

export interface PagePreviewResult { model: ExportModel; settings: ConversionSettings; count: number; print: () => void }
export function PagedPreview({ model, settings, onReady }: { model: ExportModel; settings: ConversionSettings; onReady: (result: PagePreviewResult | null) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const [rendered, setRendered] = useState<{ model: ExportModel; settings: ConversionSettings; count: number } | null>(null)
  const count = rendered?.model === model && rendered?.settings === settings ? rendered.count : 0
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(0)
  useEffect(() => {
    const target = host.current
    if (!target) return
    let cancelled = false
    const frame = document.createElement('iframe')
    frame.title = settings.format === 'docx' ? 'Word layout preview' : 'Paginated export preview'
    frame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-modals')
    frameRef.current = frame
    let observer: ResizeObserver | undefined
    const timer = setTimeout(() => {
      setRendered(null); setPage(1); setError(''); onReady(null)
      target.replaceChildren(frame)
      void paginate(frame, model, settings).then((total) => {
        if (cancelled) return
        setRendered({ model, settings, count: total })
        const fit = () => {
          const container = frame.contentDocument?.getElementById('pages')
          if (container) container.style.zoom = String(Math.min(1, (target.clientWidth - 24) / (pageDimensions(settings)[0] * 96 / 25.4)))
        }
        fit()
        observer = new ResizeObserver(fit); observer.observe(target)
        onReady({ model, settings, count: total, print: () => { frame.contentWindow?.focus(); frame.contentWindow?.print() } })
      }).catch((reason: unknown) => { if (!cancelled) { const message = reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : String(reason); console.error('Page layout failed', reason); setError(`Page layout failed: ${message}`); onReady(null) } })
    }, 250)
    return () => { cancelled = true; clearTimeout(timer); observer?.disconnect(); frame.remove(); frameRef.current = null }
  }, [model, settings, onReady])
  useEffect(() => {
    const container = frameRef.current?.contentDocument?.getElementById('pages')
    if (container && zoom) container.style.zoom = String(zoom)
  }, [zoom])
  const go = (number: number) => {
    setPage(number)
    frameRef.current?.contentDocument?.querySelectorAll('.pagedjs_page')[number - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return <div className={styles.root}>
    <div className={styles.toolbar}>
      <span role="status"><Layers size={16} />{count ? `${count} page${count === 1 ? '' : 's'}` : error ? 'Preview unavailable' : 'Laying out pages…'}</span>
      <div><button type="button" aria-label="Previous preview page" disabled={page <= 1 || !count} onClick={() => go(page - 1)}><ChevronLeft size={16} /></button><label>Page <input aria-label="Preview page" type="number" min={1} max={count || 1} value={page} onChange={(e) => { const n = e.target.valueAsNumber; if (n >= 1 && n <= count) go(n) }} /></label><button type="button" aria-label="Next preview page" disabled={page >= count} onClick={() => go(page + 1)}><ChevronRight size={16} /></button></div>
      <div><button type="button" aria-label="Zoom out" onClick={() => setZoom(Math.max(.25, (zoom || .75) - .1))}><ZoomOut size={16} /></button><button type="button" onClick={() => { setZoom(0); const container = frameRef.current?.contentDocument?.getElementById('pages'); if (container && host.current) container.style.zoom = String(Math.min(1, (host.current.clientWidth - 24) / (pageDimensions(settings)[0] * 96 / 25.4))) }}>Fit</button><button type="button" aria-label="Zoom in" onClick={() => setZoom(Math.min(1.5, (zoom || .75) + .1))}><ZoomIn size={16} /></button></div>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div ref={host} className={styles.host} aria-busy={!count && !error} data-loading={!count && !error} />
  </div>
}
