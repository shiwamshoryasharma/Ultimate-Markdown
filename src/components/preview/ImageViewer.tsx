import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Minus, Plus, RotateCcw, X } from 'lucide-react'
import './PreviewMedia.css'

export function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [zoom, setZoom] = useState(100)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return createPortal(<dialog ref={dialog} className="um-image-viewer" aria-label={alt || 'Image viewer'} onCancel={event => { event.preventDefault(); dialog.current?.close(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="um-image-viewer__bar"><strong>{alt || 'Image preview'}</strong><div>
      <button type="button" aria-label="Zoom out" disabled={zoom <= 100} onClick={() => setZoom(value => value - 25)}><Minus size={18} /></button><output aria-label="Image zoom">{zoom}%</output>
      <button type="button" aria-label="Zoom in" disabled={zoom >= 300} onClick={() => setZoom(value => value + 25)}><Plus size={18} /></button>
      <button type="button" aria-label="Fit image" onClick={() => setZoom(100)}><RotateCcw size={18} /></button>
      <a href={src} download target="_blank" rel="noopener noreferrer" aria-label="Download image"><Download size={18} /></a>
      <button type="button" aria-label="Close image viewer" onClick={onClose}><X size={20} /></button>
    </div></div>
    <div className="um-image-viewer__canvas" data-zoomed={zoom > 100} tabIndex={0} aria-label="Image canvas"><img src={src} alt={alt} style={zoom > 100 ? { width: zoom + '%', maxWidth: 'none', maxHeight: 'none' } : undefined} /></div>
    <span className="um-image-viewer__hint">Zoom to inspect details · Scroll to explore · Esc to close</span>
  </dialog>, document.body)
}
