import { useEffect, useState, type ComponentPropsWithoutRef } from 'react'
import { resolveLocalAsset, releaseLocalAsset } from '@/services/filesystem'
import { isRemoteUrl } from '@/services/markdown/documentLinks'
import { usePreviewContext } from './PreviewContext'

function useMediaSource(src?: string) {
  const { workspace, documentPath } = usePreviewContext()
  const [resolved, setResolved] = useState<string>()
  useEffect(() => {
    if (!src || isRemoteUrl(src) || !workspace) return
    let cancelled = false
    let acquired = false
    void resolveLocalAsset(workspace, documentPath, src).then((url) => {
      if (url) {
        acquired = true
        if (cancelled) releaseLocalAsset(workspace, documentPath, src)
        else setResolved(url)
      }
    })
    return () => { cancelled = true; if (acquired) releaseLocalAsset(workspace, documentPath, src) }
  }, [workspace, documentPath, src])
  return src && isRemoteUrl(src) ? src : resolved
}
export function PreviewVideo({ src, poster, ...props }: ComponentPropsWithoutRef<'video'>) {
  const resolved = useMediaSource(src); const resolvedPoster = useMediaSource(poster)
  return <video {...props} src={resolved} poster={resolvedPoster} controls preload="metadata" />
}
export function PreviewAudio({ src, ...props }: ComponentPropsWithoutRef<'audio'>) {
  const resolved = useMediaSource(src)
  return <audio {...props} src={resolved} controls preload="metadata" />
}
export function PreviewSource({ src, ...props }: ComponentPropsWithoutRef<'source'>) {
  const resolved = useMediaSource(src)
  return <source {...props} src={resolved} />
}
