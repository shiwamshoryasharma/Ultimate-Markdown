import DOMPurify from 'dompurify'
import TurndownService from 'turndown'
import type { ImportedDocument, ImportBlock, ImportBlockType } from '@/types/import'
import { slugify } from '@/services/markdown/slug'

import { MAX_IMPORT_BYTES, MAX_EXPANDED_DOCX_BYTES } from './limits'
export const MAX_HTML_BYTES = MAX_IMPORT_BYTES
const chrome = 'nav, [role="navigation"], [role="banner"], [role="contentinfo"], footer, .sidebar, .sphinxsidebar, .wy-nav-side, .bd-sidebar, .toc, .breadcrumbs, .breadcrumb, .cookie-banner, #cookie-banner, .advertisement, .social-share, .related-posts, .pagination, .headerlink, .version-switcher, .search, .navbar, .site-header, button, [role="button"], #page-context-menu, #page-context-menu-button, #page-context-menu-dropdown, form, input, select'
export function safeImportHtml(html: string): string {
  // Read modern image candidates from sanitized, detached HTML before removing
  // loading hints. No source scripts/styles or custom elements are activated.
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'button', 'textarea', 'select', 'video', 'audio'],
    FORBID_CONTENTS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'button', 'textarea', 'select', 'video', 'audio'],
    FORBID_ATTR: ['style', 'autofocus', 'formaction', 'background'],
    ADD_ATTR: ['data-src', 'data-original', 'data-lazy-src', 'data-srcset'],
    ALLOW_DATA_ATTR: false,
  })
  const parsed=new DOMParser().parseFromString(sanitized,'text/html')
  for(const img of parsed.querySelectorAll('img')) {
    const srcset=img.getAttribute('data-srcset') || img.getAttribute('srcset') || img.closest('picture')?.querySelector('source[srcset]')?.getAttribute('srcset') || ''
    const candidates=srcset.split(',').map(part=>{const [url,hint]=part.trim().split(/\s+/);return {url,size:parseFloat(hint)||1}}).filter(c=>c.url).sort((a,b)=>b.size-a.size)
    const selected=candidates[0]?.url || img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src') || img.getAttribute('src')
    if(selected) img.setAttribute('src',selected)
    for(const attr of ['srcset','data-srcset','data-src','data-original','data-lazy-src','loading']) img.removeAttribute(attr)
  }
  parsed.querySelectorAll('source').forEach(el=>el.remove())
  parsed.querySelectorAll('input').forEach(el=>{
    if(el.type==='checkbox'&&el.closest('li')) {const marker=parsed.createElement('span');marker.className='um-import-task';marker.textContent=el.checked?'[x] ':'[ ] ';el.replaceWith(marker)}
    else el.remove()
  })
  return DOMPurify.sanitize(parsed.body.innerHTML,{USE_PROFILES:{html:true,mathMl:true},FORBID_ATTR:['srcset','style'],ALLOW_DATA_ATTR:false})
}
export function canonicalUrl(value: string, base?: string): string {
  let url:URL
  try {url=new URL(value,base)} catch {throw new Error('Enter a complete HTTP or HTTPS page URL.')}
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter an HTTP or HTTPS page URL without credentials.')
  url.hash = ''
  return url.href
}
export function pageLinks(html: string, base: string) {
  const parsed = new DOMParser().parseFromString(safeImportHtml(html), 'text/html')
  const links = new Map<string, string>()
  for (const a of parsed.querySelectorAll('a[href]')) {
    try {
      const url = canonicalUrl(a.getAttribute('href')!, base)
      if (/\.(?:pdf|zip|docx?|png|jpe?g|svg|gif|webp|mp4|xml|json|css|js)(?:\?|$)/i.test(url)) continue
      links.set(url, a.textContent?.trim().slice(0,150) || new URL(url).pathname)
    } catch { /* unsupported link */ }
  }
  return links
}
function converter() {
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
  td.addRule('headings', {filter:['h1','h2','h3','h4','h5','h6'],replacement:(content,node)=>`\n\n${'#'.repeat(Number(node.nodeName[1]))} ${content.trim().replace(/\s*\n\s*/g,' ')}\n\n`})
  td.addRule('fencedCode', { filter: 'pre', replacement: (_content, node) => {
    const element = node as HTMLElement, code = element.querySelector('code') ?? element
    const text = code.textContent?.replace(/\n$/, '') ?? ''
    const language = /(?:language-|highlight-)([\w+-]+)/.exec(code.className + ' ' + element.className)?.[1] ?? ''
    const fence = '`'.repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), m => m[0].length + 1)))
    return `\n\n${fence}${language}\n${text}\n${fence}\n\n`
  } })
  td.addRule('table', { filter: 'table', replacement: (_content, node) => {
    const table = node as HTMLTableElement
    if (table.querySelector('[colspan], [rowspan], pre, table')) return '\n\n' + safeImportHtml(table.outerHTML) + '\n\n'
    const rows = Array.from(table.rows, row => Array.from(row.cells, cell => td.turndown(cell.innerHTML).replace(/\n+/g, '<br>').replace(/\|/g, '\\|')))
    if (!rows.length) return ''
    const width = Math.max(...rows.map(row => row.length))
    const lines = rows.map(row => '| ' + Array.from({length:width}, (_,i) => row[i] ?? '').join(' | ') + ' |')
    lines.splice(1, 0, '| ' + Array(width).fill('---').join(' | ') + ' |')
    return '\n\n' + lines.join('\n') + '\n\n'
  } })
  td.addRule('caption', { filter: node=>node.nodeName.toLowerCase()==='figcaption'||(node as Element).classList?.contains('caption'), replacement: content => `\n\n*${content.trim()}*\n\n` })
  td.addRule('taskMarker', {filter:node=>(node as Element).classList?.contains('um-import-task'),replacement:(_content,node)=>node.textContent||''})
  td.addRule('underline', {filter:'u',replacement:content=>`<u>${content}</u>`})
  td.addRule('strikethrough', { filter: ['del', 's'], replacement: content => `~~${content}~~` })
  td.addRule('math', { filter: node => node.nodeName.toLowerCase() === 'math' || (node as HTMLElement).classList?.contains('math'), replacement: (content, node) => {
    const el = node as Element, tex = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent
    if (tex) return el.getAttribute('display') === 'block' ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`
    return content
  } })
  return td
}
function typeOf(el: Element): ImportBlockType | null {
  if (/^H[1-6]$/.test(el.tagName)) return 'heading'
  if (el.matches('.admonition, .callout, [role="note"]')) return 'callout'
  if (el.matches('.caption, figcaption')) return 'caption'
  if(el.tagName==='P'&&el.querySelector('img')&&!el.textContent?.trim()) return 'image'
  return ({ P: 'paragraph', OL: 'ordered-list', UL: 'unordered-list', IMG: 'image', TABLE: 'table', PRE: 'code', BLOCKQUOTE: 'quote', HR: 'divider' } as Record<string, ImportBlockType>)[el.tagName] ?? null
}
export function parseHtml(html: string, source: ImportedDocument['source'], options: { includeImages: boolean; extractMain?: boolean; generated?: boolean } = { includeImages: true }): ImportedDocument {
  if (new TextEncoder().encode(html).length > (options.generated?MAX_EXPANDED_DOCX_BYTES:MAX_HTML_BYTES)) throw new Error('HTML exceeds the 200 MiB import limit.')
  const originalHtml = safeImportHtml(html)
  const parsed = new DOMParser().parseFromString(originalHtml, 'text/html')
  if (parsed.querySelectorAll('*').length > 500000) throw new Error('This page has too many elements. Import a smaller article or saved HTML section.')
  const warnings: string[] = []
  const candidates = options.extractMain === false ? [] : Array.from(parsed.querySelectorAll('article, main, [role="main"], .document, .markdown-body, .theme-doc-markdown, #content'))
  const score = (el: Element) => (el.textContent?.length ?? 0) + el.querySelectorAll('p, pre, table').length * 80 - Array.from(el.querySelectorAll('nav a, .sidebar a'), a => a.textContent?.length ?? 0).reduce((a,b) => a+b,0)
  candidates.sort((a,b) => score(b) - score(a))
  const root = candidates[0] ?? parsed.body
  const extraction = candidates[0] ? `Main content: ${root.tagName.toLowerCase()}${root.id ? '#' + root.id : ''}` : options.extractMain === false ? 'Document body' : 'Review: no article landmark; cleaned document body used.'
  if (!candidates.length && options.extractMain !== false) warnings.push('No primary article landmark found. Check for remaining navigation or unrelated content.')
  const removed = root.querySelectorAll(chrome).length
  root.querySelectorAll(chrome).forEach(el => el.remove())
  root.querySelectorAll('a[aria-label="Navigate to header"], a[aria-label="Link to this heading"], a.header-anchor, a.heading-anchor').forEach(el=>el.remove())
  root.querySelectorAll('a').forEach(el=>{if(/^is this page helpful\??$/i.test(el.textContent?.trim()||''))el.remove()})
  if (removed) warnings.push(`${removed} navigation/control elements removed. Original view retains the safe source representation.`)
  const title = root.querySelector('h1')?.textContent?.trim() || parsed.querySelector('title')?.textContent?.trim() || source.name.replace(/\.(html?|docx)$/i,'') || 'Imported document'
  const slugs = new Map<string,number>(), ids = new Map<string,string>()
  root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => { const slug = slugify(el.textContent ?? '', slugs); const old = el.id || el.closest('section[id]')?.id; if (old) ids.set(old, slug) })
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href')!
    if (href.startsWith('#')) { let id=href.slice(1); try { id=decodeURIComponent(id) } catch { /* retain for review */ } a.setAttribute('href', '#' + (ids.get(id) ?? id)); continue }
    if (source.url) { try { a.setAttribute('href', new URL(href, source.url).href) } catch { a.removeAttribute('href') } }
  }
  root.querySelectorAll('img').forEach(img => {
    if (!options.includeImages) { img.remove(); return }
    const src = img.getAttribute('src') || ''
    if(img.matches('[aria-hidden="true"],.icon,.logo,.avatar')) {img.remove();return}
    if (source.url && src && !src.startsWith('data:')) { try { img.setAttribute('src', new URL(src, source.url).href) } catch { /* validation below */ } }
    if (src.startsWith('data:') && !/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(src)) { img.removeAttribute('src'); warnings.push('Unsupported embedded image removed; use PNG, JPEG, GIF or WebP.') }
  })
  const td = converter(), id = crypto.randomUUID(), blocks: ImportBlock[] = []
  const add = (el: Element, type: ImportBlockType) => {
    let markdown = td.turndown(el.outerHTML).trim()
    if (type === 'callout') markdown = markdown.split('\n').map(line => '> ' + line).join('\n')
    if (!markdown && type !== 'divider') return
    const notes: string[] = []
    const images = [...(el.tagName === 'IMG' ? [el] : []), ...el.querySelectorAll('img')]
    for (const img of images) {
      const src = img.getAttribute('src') ?? ''
      if (!src || !/^(https?:|data:image\/(png|jpeg|gif|webp);base64,)/i.test(src)) notes.push('Unresolved local image: ' + (src || '(missing source)') + '. Attach its image files or edit the path.')
      if (!img.getAttribute('alt')) notes.push('Image has no alternative text.')
      if (!img.closest('figure')?.querySelector('figcaption')) notes.push('Image has no caption; add one if needed.')
    }
    if (type === 'table') {
      const rows = Array.from((el as HTMLTableElement).rows ?? [])
      if (!rows.length || new Set(rows.map(row => row.cells.length)).size > 1) notes.push('Table rows have different cell counts; inspect the layout.')
      if (el.querySelector('[colspan], [rowspan]')) notes.push('Merged table cells preserved as HTML; review DOCX layout.')
    }
    if (el.querySelector('math') && !el.querySelector('annotation[encoding="application/x-tex"]')) notes.push('Math has no TeX source; check the extracted text.')
    blocks.push({ id: `${id}-block-${blocks.length}`, sourceId: el.id || undefined, type, markdown, include: true, removed: false, warnings: notes })
  }
  const walk = (parent: Element) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) { if (node.textContent?.trim()) { const p = parsed.createElement('p'); p.textContent = node.textContent; add(p, 'paragraph') } continue }
      if (!(node instanceof Element)) continue
      const type = typeOf(node)
      if (type) add(node, type)
      else if (node.matches('div, section, article, main, header, figure, picture, aside, dl, dd, dt, details, summary, body')) walk(node)
      else if(node.matches('span, small')) add(node,'paragraph')
      else { add(node, 'paragraph'); warnings.push(`Review unsupported <${node.tagName.toLowerCase()}> content converted to text/Markdown.`) }
    }
  }
  if (typeOf(root)) add(root, typeOf(root)!)
  else walk(root)
  if (!blocks.length) throw new Error('No readable content found. Try saved HTML, a direct documentation page, or paste the article HTML.')
  if (blocks.length > 100000) throw new Error('More than 100,000 content blocks found. Import a smaller section.')
  return { id, title, source, originalHtml, blocks, warnings: [...new Set(warnings)], extraction }
}
