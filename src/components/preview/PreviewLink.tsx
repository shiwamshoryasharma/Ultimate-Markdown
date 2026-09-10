import type { ComponentPropsWithoutRef, MouseEvent } from 'react'
import { usePreviewContext } from './PreviewContext'
import { isRemoteUrl, resolveDocumentPath } from '@/services/markdown/documentLinks'
import { useWorkspaceStore } from '@/stores/workspaceStore'

type AnchorProps = ComponentPropsWithoutRef<'a'>
export function PreviewLink({ href, children, ...rest }: AnchorProps) {
  const { documentPath, workspace, onNavigateToDocument } = usePreviewContext()
  const overrides = useWorkspaceStore((state) => state.linkOverrides)
  if (!href) return <a {...rest}>{children}</a>
  if (isRemoteUrl(href)) return <a {...rest} href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  const original = resolveDocumentPath(documentPath, href)
  const resolved = original ? overrides[`${documentPath}::${original}`] ?? original : null
  const target = resolved ? Array.from(workspace?.filesById.values() ?? []).find(node => node.path === resolved) : null
  const anchor = href.startsWith('#')
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (anchor) {
      let id = href.slice(1); try { id = decodeURIComponent(id) } catch { /* Keep malformed anchors inert. */ }
      event.currentTarget.closest('.markdown-content')?.querySelector('#' + CSS.escape(id))?.scrollIntoView({ behavior: 'smooth' })
    } else if (target && resolved) onNavigateToDocument?.(resolved)
  }
  if (resolved === '__stop__') return <span title="End of this manual">{children}</span>
  return <a {...rest} href={href} onClick={handleClick} title={!anchor && !target ? 'Local target is not available in this workspace: ' + href : rest.title} data-missing-link={!anchor && !target || undefined}>{children}</a>
}
