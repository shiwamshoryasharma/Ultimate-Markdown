import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import remarkFrontmatter from 'remark-frontmatter'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import type { Root, Element, RootContent } from 'hast'
import type { Workspace, FileNode } from '@/types/filesystem'
import { hasFolderAccess } from '@/types/filesystem'
import type { OpenDocument } from '@/types/document'
import type { ConversionSettings } from '@/types/conversion'
import { readFileText } from '@/services/filesystem/fileIO'
import { resolveLocalAsset, releaseLocalAsset } from '@/services/filesystem/localAssets'
import { markdownSanitizeSchema } from '@/services/markdown/sanitizeSchema'
import { documentStylePlugin } from '@/services/markdown/documentStyles'
import { isRemoteUrl, markdownTarget } from '@/services/markdown/documentLinks'
import { readNavigation } from '@/services/markdown/navigationPlugin'
import { slugify } from '@/services/markdown/slug'

export interface SourceDocument { embeddedAssets?: Record<string,string>; id: string; path: string; content: string; assetWorkspace?: Workspace | null; standalone?: boolean }
export interface ModelDocument extends SourceDocument { tree: Root; css: string; scope: string }
export interface ExportModel { documents: ModelDocument[]; warnings: string[] }
export interface MissingDocumentLink { from: string; target: string }
export const STOP_LINK = '__stop__'

export function walkElements(parent: Root | Element, visit: (node: Element, parent: Root | Element) => void) {
  for (const node of [...parent.children]) if (node.type === 'element') { visit(node, parent); walkElements(node, visit) }
}
export function nodeText(node: Root | RootContent): string {
  return node.type === 'text' ? node.value : 'children' in node ? node.children.map(nodeText).join('') : ''
}
export function parseDocument(content: string, scope: string): { tree: Root; css: string } {
  let css = ''
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkBreaks).use(remarkFrontmatter)
    .use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw)
    .use(documentStylePlugin, { scope: `#${scope}`, collect: (value: string) => { css = value } })
    .use(rehypeSanitize, markdownSanitizeSchema).use(rehypeHighlight).use(rehypeKatex)
  const tree = processor.runSync(processor.parse(content)) as Root
  return { tree, css }
}

/** DFS in source link order, preferring explicit Next/Continue controls when present.
 * Every document is read/parsed once per session; unsaved editor buffers win. */
export async function collectDocuments(workspace: Workspace | null, open: Map<string, OpenDocument>, currentId: string | null, mode: ConversionSettings['sourceMode'], selected: string[] = [], overrides: Record<string, string> = {}) {
  const warnings: string[] = []
  const missingLinks: MissingDocumentLink[] = []
  const result: SourceDocument[] = []
  const visited = new Set<string>()
  const nodes = new Map<string, FileNode>()
  workspace?.filesById.forEach((node) => nodes.set(node.id, node))
  open.forEach((doc) => nodes.set(doc.id, doc.node))
  // Loose files and asset-only attachments never grant permission to follow documents.
  const followChain = mode === 'linked-chain' && hasFolderAccess(workspace) && !nodes.get(currentId ?? '')?.standalone && !!workspace?.filesById.has(currentId ?? '')
  const workspacePaths = new Map(Array.from(workspace?.filesById.values() ?? []).map((node) => [node.path, node]))
  const visit = async (id: string): Promise<void> => {
    const node = nodes.get(id)
    if (!node || visited.has(node.path)) return
    visited.add(node.path)
    let content: string
    try { content = open.get(id)?.content ?? await readFileText(node) } catch (error) { throw new Error(`Cannot read ${node.path}: ${error instanceof Error ? error.message : 'permission denied'}`) }
    result.push({ embeddedAssets:node.embeddedAssets, id, path: node.path, content, standalone: node.standalone, assetWorkspace: node.assetWorkspace ?? (node.standalone ? null : workspace) })
    if (!followChain) return
    const { tree } = parseDocument(content, 'discovery')
    const navigation = new Map<string, 'previous' | 'next'>()
    walkElements(tree, element => { for (const item of readNavigation(element) ?? []) navigation.set(item.href, item.direction) })
    const links: { target: string; next: boolean; previous: boolean }[] = []
    walkElements(tree, (element, parent) => {
      if (element.tagName !== 'a' || typeof element.properties.href !== 'string') return
      const target = markdownTarget(node.path, element.properties.href)
      if (!target) return
      const index = parent.children.indexOf(element)
      const before = parent.children.slice(0, index).map(nodeText).join('').split(/\|\||\n/).pop() ?? ''
      const label = `${before.slice(-30)} ${nodeText(element)}`
      const detected = navigation.get(element.properties.href)
      links.push({ target, next: detected ? detected === 'next' : /\b(next|continue)\b/i.test(label), previous: detected ? detected === 'previous' : /\b(previous|prev|back)\b/i.test(label) })
    })
    const nextLinks = links.filter((link) => link.next && !link.previous)
    const follow = nextLinks
    for (const link of follow) {
      const mapped = overrides[`${node.path}::${link.target}`] ?? link.target
      if (mapped === STOP_LINK) continue
      const target = workspacePaths.get(mapped)
      if (target) await visit(target.id)
      else { warnings.push(`Missing linked document: ${link.target} (from ${node.path}).`); missingLinks.push({ from: node.path, target: link.target }) }
    }
  }
  const ids = mode === 'workspace' ? Array.from(workspace?.filesById.keys() ?? []) : mode === 'selected' ? selected : currentId ? [currentId] : []
  for (const id of ids) await visit(id)
  return { documents: result, warnings, missingLinks }
}

async function embedAsset(workspace: Workspace | null, path: string, src: string): Promise<string | null> {
  if (/^data:image\/(png|jpeg|gif|webp|svg\+xml);/i.test(src)) return src
  if (isRemoteUrl(src) || !workspace) return null
  const url = await resolveLocalAsset(workspace, path, src)
  if (!url) return null
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob)
    })
  } finally { releaseLocalAsset(workspace, path, src) }
}

export async function buildExportModel(sources: SourceDocument[], settings: ConversionSettings, workspace: Workspace | null, initialWarnings: string[] = [], overrides: Record<string, string> = {}): Promise<ExportModel> {
  const warnings = [...initialWarnings]
  const documents = sources.map((source, index): ModelDocument => ({ ...source, ...parseDocument(source.content, `export-doc-${index}`), scope: `export-doc-${index}` }))
  const paths = new Map(documents.map((doc) => [doc.path, doc.scope]))
  const assets = new Map<string, Promise<string | null>>()
  for (const doc of documents) {
    const navigation = settings.internalMarkdownLinks === 'hide-if-included' ? navigationBlocks(doc.tree) : new Set<Element>()
    const slugs = new Map<string, number>()
    // IDs are namespaced to avoid collisions when multiple documents use #overview.
    const idMap = new Map<string, string>()
    walkElements(doc.tree, (node) => {
      if (/^h[1-6]$/.test(node.tagName)) {
        const slug = slugify(nodeText(node), slugs)
        node.properties.id = `${doc.scope}-${slug}`
        idMap.set(slug, String(node.properties.id))
      } else if (node.properties.id) {
        const raw = String(node.properties.id).replace(/^user-content-/, '')
        node.properties.id = `${doc.scope}-${raw}`; idMap.set(raw, String(node.properties.id))
      }
    })
    const pending: Promise<void>[] = []
    walkElements(doc.tree, (node, parent) => {
      if (node.tagName === 'a' && typeof node.properties.href === 'string') {
        const href = node.properties.href
        const originalTarget = markdownTarget(doc.path, href)
        const target = originalTarget ? overrides[`${doc.path}::${originalTarget}`] ?? originalTarget : null
        if (target === STOP_LINK) { node.tagName = 'span'; node.properties = {}; return }
        if (target && paths.has(target)) {
          if (settings.internalMarkdownLinks === 'hide-if-included') {
            parent.children.splice(parent.children.indexOf(node), 1)
            // A standalone navigation paragraph should disappear as a whole.
            const remaining = nodeText(parent).replace(/\b(previous|prev|next|continue|back)\b/gi, '').replace(/[\s:|→←•·-]/g, '')
            if (!remaining) parent.children = []
          } else {
            const hash = href.split('#')[1]
            node.properties.href = `#${paths.get(target)}${hash ? `-${decodeHash(hash)}` : ''}`
          }
        } else if (target && !doc.standalone && !initialWarnings.includes(`Missing linked document: ${originalTarget} (from ${doc.path}).`)) warnings.push(`Local link is not included: ${target} (from ${doc.path}).`)
        else if (href.startsWith('#')) node.properties.href = `#${idMap.get(decodeHash(href.slice(1))) ?? `${doc.scope}-${decodeHash(href.slice(1)).replace(/^user-content-/, '')}`}`
        else if (isRemoteUrl(href)) node.properties.rel = ['noopener', 'noreferrer']
      }
      if (['img', 'video', 'audio', 'source'].includes(node.tagName) && typeof node.properties.src === 'string') {
        const src = node.properties.src
        const key = `${doc.path}::${src}`
        if (!assets.has(key)) assets.set(key, doc.embeddedAssets?.[src] ? Promise.resolve(doc.embeddedAssets[src]) : embedAsset(doc.assetWorkspace === undefined ? workspace : doc.assetWorkspace, doc.path, src))
        pending.push(assets.get(key)!.then((data) => {
          if (data) node.properties.src = data
          else { warnings.push(`Asset not embedded: ${src} (${doc.path}).`); if (!isRemoteUrl(src)) { node.tagName = 'span'; node.properties = {}; node.children = [{ type: 'text', value: `[Missing media: ${src}]` }] } }
        }))
      }
    })
    await Promise.all(pending)
    removeBlocks(doc.tree, navigation)
  }
  return { documents, warnings: [...new Set(warnings)] }
}
function decodeHash(hash: string) { try { return decodeURIComponent(hash) } catch { return hash } }
export function serializeTree(tree: Root): string { return unified().use(rehypeStringify).stringify(tree) }

export function plainText(tree: Root): string {
  const text = (node: Root | RootContent): string => {
    if (node.type === 'text') return node.value
    if (!('children' in node)) return ''
    if (node.type === 'element' && node.tagName === 'style') return ''
    if (node.type === 'element' && node.tagName === 'img') return String(node.properties.alt ?? '')
    if (node.type === 'element' && node.tagName === 'br') return '\n'
    const content = node.children.map(text).join('')
    if (node.type !== 'element') return content
    if (node.tagName === 'a' && typeof node.properties.href === 'string' && isRemoteUrl(node.properties.href)) return `${content} (${node.properties.href})`
    if (node.tagName === 'li') return `• ${content.trim()}\n`
    if (['th', 'td'].includes(node.tagName)) return `${content}\t`
    return /^(h[1-6]|p|div|section|article|aside|blockquote|pre|tr|ul|ol|hr)$/.test(node.tagName) ? `${content}\n\n` : content
  }
  return text(tree).replace(/\n[\t ]*\n(?:[\t ]*\n)+/g, '\n\n').trim()
}

/** Navigation chrome is removed as a unit; ordinary references remain content. */
function navigationBlocks(tree: Root): Set<Element> {
  const removed = new Set<Element>()
  const isNavigation = (node: RootContent): node is Element => readNavigation(node) !== null
  const scan = (parent: Root | Element) => {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i]
      if (isNavigation(child)) removed.add(child)
      if (child.type !== 'element') continue
      if (/^h[1-6]$/.test(child.tagName) && /^(document|page|chapter)?\s*navigation$/i.test(nodeText(child).trim())) {
        const next = parent.children.slice(i + 1).find((node) => node.type !== 'text' || node.value.trim())
        if (next && isNavigation(next)) { removed.add(child); removed.add(next) }
      }
      scan(child)
    }
  }
  scan(tree)
  return removed
}
function removeBlocks(parent: Root | Element, removed: Set<Element>) {
  parent.children = parent.children.filter((node) => node.type !== 'element' || !removed.has(node)) as typeof parent.children
  for (const node of parent.children) if (node.type === 'element') removeBlocks(node, removed)
}
