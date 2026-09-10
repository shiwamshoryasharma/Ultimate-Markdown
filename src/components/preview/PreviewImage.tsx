import { useContext, useEffect, useRef, useState } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { ImageOff, Maximize2 } from 'lucide-react'
import type { ExtraProps } from 'react-markdown'
import { useSettingsStore } from '@/stores/settingsStore'
import { ImageViewer } from './ImageViewer'
import { useDocumentStore } from '@/stores/documentStore'
import { attachImage } from '@/services/filesystem/attachImage'
import { releaseLocalAsset, resolveLocalAsset } from '@/services/filesystem'
import { LinkedImageContext, usePreviewContext } from './PreviewContext'
import styles from './PreviewImage.module.css'

type ImgProps = ComponentPropsWithoutRef<'img'>

function isRemote(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')
}

/** Resolves `./assets/foo.png`-style relative image references against the workspace (see services/filesystem/localAssets.ts); remote URLs pass through untouched. */
export function PreviewImage({ src, alt, node: _node, ...rest }: ImgProps & ExtraProps) {
  const { documentPath, workspace } = usePreviewContext()
  const [result, setResult] = useState<{ src: string; path: string; workspace: typeof workspace; url?: string; missing: boolean }>()
  const trigger = useRef<HTMLButtonElement>(null)
  const [viewing, setViewing] = useState(false)
  const linked = useContext(LinkedImageContext)
  const captions = useSettingsStore(state => state.preview.imageCaptions)
  const matches = result?.src === src && result?.path === documentPath && result?.workspace === workspace
  const resolvedSrc = src && isRemote(src) ? src : matches ? result?.url : undefined
  const missing = matches && result?.missing || !!src && !isRemote(src) && !workspace
  useEffect(() => {
    if (!src || isRemote(src) || !workspace) return
    let cancelled = false, acquired = false
    resolveLocalAsset(workspace, documentPath, src).then(url => {
      if (cancelled) { if (url) releaseLocalAsset(workspace, documentPath, src); return }
      acquired = !!url
      setResult({ src, path: documentPath, workspace, url: url ?? undefined, missing: !url })
    }).catch(() => { if (!cancelled) setResult({ src, path: documentPath, workspace, missing: true }) })
    return () => { cancelled = true; if (acquired) releaseLocalAsset(workspace, documentPath, src) }
  }, [src, documentPath, workspace])

  if (missing) {
    return (
      <span className={styles.missing} title={`Image not found: ${src}`}>
        <ImageOff aria-hidden="true" />
        {alt || 'Missing image'}
        {src && !isRemote(src) && <button type="button" onClick={() => {
          const state = useDocumentStore.getState()
          const current = state.activeId ? state.documents.get(state.activeId) : undefined
          const doc = current?.node.path === documentPath ? current : Array.from(state.documents.values()).find((entry) => entry.node.path === documentPath)
          if (doc) attachImage(doc.id, src, workspace)
        }}>Locate image</button>}
      </span>
    )
  }

  if (!resolvedSrc) {
    return <span className={styles.placeholder} aria-hidden="true" />
  }

  const picture = <img {...rest} src={resolvedSrc} alt={alt} loading="lazy" className={styles.image} onError={() => setResult({ src: src || '', path: documentPath, workspace, missing: true })} />
  if (linked) return picture
  return <span className="um-image-card">
    <button ref={trigger} type="button" className="um-image-card__open" aria-label={`Expand image: ${alt || 'Untitled image'}`} onClick={() => setViewing(true)}>{picture}<span className="um-image-card__badge"><Maximize2 size={14} />Expand image</span></button>
    {captions && alt && <span className="um-image-card__caption">{alt}</span>}
    {viewing && <ImageViewer src={resolvedSrc} alt={alt || ''} onClose={() => { setViewing(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })) }} />}
  </span>
}
