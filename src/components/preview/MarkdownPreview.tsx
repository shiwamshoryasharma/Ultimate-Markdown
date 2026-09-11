import { memo, useId, useMemo } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkMath from 'remark-math'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import clsx from 'clsx'
import type { Root, RootContent, Element } from 'hast'
import type { Workspace } from '@/types/filesystem'
import type { PreviewSettings } from '@/types/settings'
import { markdownSanitizeSchema } from '@/services/markdown/sanitizeSchema'
import { documentStylePlugin, appendDocumentCss } from '@/services/markdown/documentStyles'
import { slugify } from '@/services/markdown/slug'
import { CodeBlock } from './CodeBlock'
import { PreviewImage } from './PreviewImage'
import { PreviewTable } from './PreviewTable'
import { PreviewLink } from './PreviewLink'
import { DocumentNavigation } from './DocumentNavigation'
import { navigationPlugin } from '@/services/markdown/navigationPlugin'
import { PreviewVideo, PreviewAudio, PreviewSource } from './PreviewMedia'
import { PreviewContextProvider } from './PreviewContext'
import '@/styles/markdown-content.css'
import '@/styles/hljs-theme.css'
import 'katex/dist/katex.min.css'
import styles from './MarkdownPreview.module.css'

interface MarkdownPreviewProps {
  content: string
  documentPath: string
  workspace: Workspace | null
  navigationWorkspace?: Workspace | null
  onNavigateToDocument?: (path: string) => void
  fontSize?: number
  contentWidth?: PreviewSettings['contentWidth']
  className?: string
}
const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath, remarkFrontmatter]
function headingIds() {
  return (tree: Root) => {
    const counts = new Map<string, number>()
    const text = (node: Root | RootContent): string => node.type === 'text' ? node.value : 'children' in node ? node.children.map(text).join('') : ''
    const walk = (parent: Root | Element) => {
      for (const child of parent.children) if (child.type === 'element') {
        if (/^h[1-6]$/.test(child.tagName)) child.properties.id = slugify(text(child), counts)
        walk(child)
      }
    }
    walk(tree)
  }
}
const components = { pre: CodeBlock, img: PreviewImage, table: PreviewTable, a: PreviewLink, nav: DocumentNavigation, video: PreviewVideo, audio: PreviewAudio, source: PreviewSource }
function previewUrl(url: string, key: string, node: Element) {
  // Imported raster images are embedded locally. Never permit data URLs on links.
  if (key === 'src' && node.tagName === 'img' && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(url)) return url
  return defaultUrlTransform(url)
}
function MarkdownPreviewImpl({ content, documentPath, workspace, navigationWorkspace = workspace, onNavigateToDocument, fontSize = 16, contentWidth = 'comfortable', className }: MarkdownPreviewProps) {
  const id = 'preview-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const plugins = useMemo<NonNullable<Parameters<typeof ReactMarkdown>[0]['rehypePlugins']>>(() => [
    rehypeRaw, [documentStylePlugin, { scope: '#' + id }],
    [rehypeSanitize, markdownSanitizeSchema], rehypeHighlight, rehypeKatex, headingIds, navigationPlugin, appendDocumentCss,
  ], [id])
  return <PreviewContextProvider value={{ documentPath, workspace, navigationWorkspace, onNavigateToDocument }}>
    <div id={id} className={clsx('markdown-content', styles.content, styles[contentWidth], className)} style={{ fontSize: fontSize + 'px' }}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={plugins} components={components} urlTransform={previewUrl}>{content}</ReactMarkdown>
    </div>
  </PreviewContextProvider>
}
export const MarkdownPreview = memo(MarkdownPreviewImpl)
