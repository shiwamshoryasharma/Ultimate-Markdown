import { useEffect, useState } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { ImageOff } from 'lucide-react'
import { useDocumentStore } from '@/stores/documentStore'
import { attachImage } from '@/services/filesystem/attachImage'
import { releaseLocalAsset, resolveLocalAsset } from '@/services/filesystem'
import { usePreviewContext } from './PreviewContext'
import styles from './PreviewImage.module.css'

type ImgProps = ComponentPropsWithoutRef<'img'>

function isRemote(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')
}

/** Resolves `./assets/foo.png`-style relative image references against the workspace (see services/filesystem/localAssets.ts); remote URLs pass through untouched. */
export function PreviewImage({ src, alt, ...rest }: ImgProps) {
  const { documentPath, workspace } = usePreviewContext()
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!src) return
    if (isRemote(src)) {
      setResolvedSrc(src)
      setMissing(false)
      return
    }
    if (!workspace) { setMissing(true); setResolvedSrc(undefined); return }

    let cancelled = false
    setMissing(false)
    setResolvedSrc(undefined)

    let acquired = false
    resolveLocalAsset(workspace, documentPath, src).then((url) => {
      if (cancelled) { if (url) releaseLocalAsset(workspace, documentPath, src); return }
      acquired = !!url
      if (url) setResolvedSrc(url)
      else setMissing(true)
    }).catch(() => { if (!cancelled) setMissing(true) })

    return () => {
      cancelled = true
      if (acquired) releaseLocalAsset(workspace, documentPath, src)
    }
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

  return <img {...rest} src={resolvedSrc} alt={alt} loading="lazy" className={styles.image} onError={() => setMissing(true)} />
}
