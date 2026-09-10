import type { Element, Root, RootContent } from 'hast'
import type { ParagraphChild, IRunOptions, Paragraph, Table } from 'docx'
import type { ExportModel } from './model'
import { nodeText } from './model'
import type { ConversionSettings } from '@/types/conversion'
import { pageDimensions } from '@/types/conversion'

export async function exportDocx(model: ExportModel, s: ConversionSettings): Promise<Blob> {
  const d = await import('docx')
  const mm = (value: number) => Math.round(value * 1440 / 25.4)
  const [width, height] = pageDimensions(s)
  const alignment = s.alignment === 'justify' ? d.AlignmentType.JUSTIFIED : d.AlignmentType.LEFT
  const bookmark = (id: string) => `b_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`
  const inline = (node: RootContent, style: IRunOptions = {}): ParagraphChild[] => {
    if (node.type === 'text') return [new d.TextRun({ ...style, text: node.value })]
    if (node.type !== 'element') return []
    const next: { -readonly [K in keyof IRunOptions]: IRunOptions[K] } = { ...style }
    if (['strong', 'b', 'th'].includes(node.tagName)) next.bold = true
    if (['em', 'i'].includes(node.tagName)) next.italics = true
    if (['del', 's'].includes(node.tagName)) next.strike = true
    if (node.tagName === 'code') next.font = 'Courier New'
    if (node.tagName === 'br') return [new d.TextRun({ break: 1 })]
    if (node.tagName === 'img') {
      const src = String(node.properties.src ?? '')
      const match = /^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/i.exec(src)
      if (match) {
        const data = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0))
        const type = /jpe?g/.test(match[1]) ? 'jpg' : match[1] as 'png' | 'gif' | 'bmp'
        const dimensions = imageSizes.get(src) ?? [480, 300]
        const maxWidth = (width - s.margins.left - s.margins.right - (s.columns - 1) * s.columnGap) / s.columns * 96 / 25.4
        const scale = Math.min(1, maxWidth / dimensions[0])
        return [new d.ImageRun({ data, type, transformation: { width: Math.round(dimensions[0] * scale), height: Math.round(dimensions[1] * scale) }, altText: { title: String(node.properties.alt ?? ''), description: String(node.properties.alt ?? ''), name: 'Image' } })]
      }
      return [new d.TextRun(`[Image: ${String(node.properties.alt ?? src)}]`)]
    }
    if (node.tagName === 'a') { next.color = s.linkColor.slice(1); next.underline = {} }
    const children = node.children.flatMap((child) => inline(child, next))
    if (node.tagName === 'a' && typeof node.properties.href === 'string') {
      const href = node.properties.href
      if (href.startsWith('#')) return [new d.InternalHyperlink({ anchor: bookmark(href.slice(1)), children })]
      if (/^(https?:|mailto:)/i.test(href)) return [new d.ExternalHyperlink({ link: href, children })]
    }
    return children
  }
  const imageSizes = new Map<string, [number, number]>()
  const { walkElements } = await import('./model')
  const images = new Set<string>()
  model.documents.forEach((doc) => walkElements(doc.tree, (node) => { if (node.tagName === 'img' && String(node.properties.src).startsWith('data:')) images.add(String(node.properties.src)) }))
  await Promise.all(Array.from(images).map((src) => new Promise<void>((resolve) => {
    const img = new Image(); img.onload = () => { imageSizes.set(src, [img.naturalWidth, img.naturalHeight]); resolve() }; img.onerror = () => resolve(); img.src = src
  })))
  let listIndex = 0
  const numbering: { reference: string; levels: { level: number; format: typeof d.LevelFormat.DECIMAL; text: string; alignment: typeof d.AlignmentType.LEFT; style: { paragraph: { indent: { left: number; hanging: number } } } }[] }[] = []
  const paragraph = (node: Element, children?: ParagraphChild[], extra: ConstructorParameters<typeof d.Paragraph>[0] = {}) => {
    const content = children ?? node.children.flatMap((child) => inline(child))
    return new d.Paragraph({ alignment, spacing: { after: s.paragraphSpacing * 20, line: Math.round(s.lineHeight * 240) }, ...(typeof extra === 'object' ? extra : {}), children: node.properties.id ? [new d.Bookmark({ id: bookmark(String(node.properties.id)), children: content })] : content })
  }
  const blocks = (parent: Root | Element, level = 0): (Paragraph | Table)[] => {
    const result: (Paragraph | Table)[] = []
    let pending: ParagraphChild[] = []
    const flush = () => { if (pending.length) { result.push(new d.Paragraph({ children: pending, alignment, spacing: { after: 140, line: Math.round(s.lineHeight * 240) } })); pending = [] } }
    for (const node of parent.children) {
      if (node.type === 'text') { if (node.value.trim()) pending.push(...inline(node)); continue }
      if (node.type !== 'element') continue
      if (['style', 'script'].includes(node.tagName)) continue
      const tag = node.tagName
      if (/^h[1-6]$/.test(tag)) {
        flush(); const n = Number(tag[1])
        result.push(paragraph(node, node.children.flatMap((child) => inline(child, { bold: true, color: s.headingColor.slice(1), size: Math.round(s.headingSizes[n - 1] * 2) })), { keepNext: true, outlineLevel: n - 1, spacing: { before: 280, after: 160 } }))
      } else if (tag === 'p') { flush(); result.push(paragraph(node)) }
      else if (tag === 'pre') { flush(); result.push(paragraph(node, [new d.TextRun({ text: nodeText(node), font: 'Courier New', size: Math.round(s.codeFontSize * 2), color: s.codeStyle === 'dark' ? 'F8FAFC' : s.textColor.slice(1) })], { shading: { fill: s.codeStyle === 'dark' ? '172033' : s.codeStyle === 'minimal' ? s.pageColor.slice(1) : 'F1F5F9' }, spacing: { before: 100, after: 180, line: 260 } })) }
      else if (tag === 'ul' || tag === 'ol') {
        flush(); const ref = `list-${listIndex++}`
        if (tag === 'ol') numbering.push({ reference: ref, levels: Array.from({ length: 9 }, (_, l) => ({ level: l, format: d.LevelFormat.DECIMAL, text: `%${l + 1}.`, alignment: d.AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (l + 1), hanging: 260 } } } })) })
        for (const li of node.children) if (li.type === 'element' && li.tagName === 'li') {
          const direct = li.children.filter((child) => !(child.type === 'element' && ['ul', 'ol'].includes(child.tagName)))
          result.push(paragraph(li, direct.flatMap((child) => inline(child)), tag === 'ol' ? { numbering: { reference: ref, level: Math.min(level, 8) } } : { bullet: { level: Math.min(level, 8) } }))
          for (const nested of li.children) if (nested.type === 'element' && ['ul', 'ol'].includes(nested.tagName)) result.push(...blocks({ type: 'root', children: [nested] }, level + 1))
        }
      } else if (tag === 'table') {
        flush(); const rows: Element[] = []
        walkElements(node, (row) => { if (row.tagName === 'tr') rows.push(row) })
        const border = { style: s.tableStyle === 'minimal' ? d.BorderStyle.NONE : d.BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }
        result.push(new d.Table({ width: { size: 100, type: d.WidthType.PERCENTAGE }, borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: s.tableStyle === 'grid' ? border : { style: d.BorderStyle.NONE } }, rows: rows.map((row, index) => new d.TableRow({ tableHeader: row.children.some((cell) => cell.type === 'element' && cell.tagName === 'th'), children: row.children.filter((cell): cell is Element => cell.type === 'element' && ['th', 'td'].includes(cell.tagName)).map((cell) => new d.TableCell({ shading: { fill: cell.tagName === 'th' && s.tableStyle !== 'minimal' ? 'EDF2FA' : s.tableStyle === 'simple' && index % 2 ? 'F8FAFC' : 'FFFFFF' }, children: [paragraph(cell, cell.children.flatMap((child) => inline(child, { bold: cell.tagName === 'th' })))], margins: { top: 80, bottom: 80, left: 100, right: 100 } })) })) }))
      } else if (tag === 'blockquote') { flush(); result.push(...blocks(node).map((block) => block)) }
      else if (tag === 'hr') { flush(); result.push(new d.Paragraph({ border: { bottom: { style: d.BorderStyle.SINGLE, size: 4, color: 'CBD5E1' } } })) }
      else if (['div', 'section', 'article', 'aside', 'details', 'summary'].includes(tag)) { flush(); result.push(...blocks(node, level)) }
      else pending.push(...inline(node))
    }
    flush(); return result
  }
  const children: (Paragraph | Table)[] = []
  model.documents.forEach((doc, index) => {
    children.push(new d.Paragraph({ spacing: { before: 0, after: 0, line: 1 }, pageBreakBefore: index > 0 && s.linkedDocumentSeparation === 'new-page', children: [new d.Bookmark({ id: bookmark(doc.scope), children: [] })] }))
    children.push(...blocks(doc.tree))
  })
  const footerRuns: ParagraphChild[] = []
  if (s.footer.customText) footerRuns.push(new d.TextRun(s.footer.customText + (s.footer.pageNumbers ? ' · ' : '')))
  if (s.footer.pageNumbers) {
    if (['page', 'page-total'].includes(s.footer.pageNumberFormat)) footerRuns.push(new d.TextRun('Page '))
    footerRuns.push(new d.TextRun({ children: [d.PageNumber.CURRENT] }))
    if (['page-total', 'fraction'].includes(s.footer.pageNumberFormat)) footerRuns.push(new d.TextRun({ children: [s.footer.pageNumberFormat === 'fraction' ? ' / ' : ' of ', d.PageNumber.TOTAL_PAGES] }))
  }
  const doc = new d.Document({
    background: { color: s.pageColor.slice(1) },
    styles: { default: { document: { run: { font: s.fontFamily, size: s.bodyFontSize * 2, color: s.textColor.slice(1) }, paragraph: { spacing: { after: s.paragraphSpacing * 20, line: Math.round(s.lineHeight * 240) } } } } },
    numbering: { config: numbering },
    sections: [{ properties: { column: { count: s.columns, space: mm(s.columnGap), equalWidth: true }, page: { size: { width: mm(width), height: mm(height) }, margin: { top: mm(s.margins.top), right: mm(s.margins.right), bottom: mm(s.margins.bottom), left: mm(s.margins.left), header: mm(5), footer: mm(5) } } },
      headers: s.header.enabled ? { default: new d.Header({ children: [new d.Paragraph({ text: s.header.text, alignment: d.AlignmentType.CENTER })] }) } : undefined,
      footers: s.footer.enabled ? { default: new d.Footer({ children: [new d.Paragraph({ children: footerRuns, alignment: { left: d.AlignmentType.LEFT, center: d.AlignmentType.CENTER, right: d.AlignmentType.RIGHT }[s.footer.alignment] })] }) } : undefined,
      children,
    }],
  })
  return d.Packer.toBlob(doc)
}
