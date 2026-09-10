import type { ConversionSettings } from '@/types/conversion'
import { pageDimensions } from '@/types/conversion'
import type { ExportModel } from './model'
import { serializeTree, walkElements } from './model'

export function escapeHtml(text: string): string { return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;') }
function cssString(text: string) { return JSON.stringify(text).replaceAll('<', '\\3c ').replaceAll('>', '\\3e ') }
export function footerLabel(s: ConversionSettings, page = '1', total = '…') {
  const number = s.footer.pageNumbers ? ({ number: page, page: `Page ${page}`, 'page-total': `Page ${page} of ${total}`, fraction: `${page} / ${total}` })[s.footer.pageNumberFormat] : ''
  return [s.footer.customText, number].filter(Boolean).join(' · ')
}
export function exportCss(s: ConversionSettings): string {
  const m = s.margins
  const [w, h] = pageDimensions(s)
  const border = s.tableStyle === 'minimal' ? 'none' : '1px solid #cbd5e1'
  const codeBg = s.codeStyle === 'dark' ? '#172033' : s.codeStyle === 'minimal' ? 'transparent' : '#f1f5f9'
  const pageCounter = { number: 'counter(page)', page: '"Page " counter(page)', 'page-total': '"Page " counter(page) " of " counter(pages)', fraction: 'counter(page) " / " counter(pages)' }[s.footer.pageNumberFormat]
  const footerContent = [s.footer.customText ? cssString(s.footer.customText + (s.footer.pageNumbers ? ' · ' : '')) : '', s.footer.pageNumbers ? pageCounter : ''].filter(Boolean).join(' ') || '""'
  return `
    *{box-sizing:border-box} html{background:#e8edf5} body{margin:0;color:${s.textColor}}
    .export-document{font-family:${cssString(s.fontFamily)},serif;font-size:${s.bodyFontSize}pt;line-height:${s.lineHeight};text-align:${s.alignment};overflow-wrap:break-word}
    .paper{background:${s.pageColor};width:${w}mm;min-height:${h}mm;margin:24px auto;padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;box-shadow:0 8px 40px #18284a14}
    .export-section{display:flow-root;isolation:isolate;overflow-wrap:anywhere;column-count:${s.columns};column-gap:${s.columnGap}mm}
    .export-section,.export-section p,.export-section li,.export-section td,.export-section th{font-family:${cssString(s.fontFamily)},serif!important;font-size:${s.bodyFontSize}pt!important;line-height:${s.lineHeight}!important;color:${s.textColor}!important}
    .export-section p{margin-top:0!important;margin-bottom:${s.paragraphSpacing}pt!important;text-align:${s.alignment}!important;orphans:2;widows:2}
    ${s.headingSizes.map((size, index) => `.export-section h${index + 1}{font-size:${size}pt!important;color:${s.headingColor}!important;font-family:${cssString(s.fontFamily)},serif!important}`).join('')}
    .export-section a{color:${s.linkColor}!important}.export-section pre,.export-section code{font-size:${s.codeFontSize}pt!important}
    h1,h2,h3,h4,h5,h6{line-height:1.22;margin:1.4em 0 .55em;font-weight:700;break-after:avoid;letter-spacing:-.025em}
    h1{font-size:2.15em;border-bottom:2px solid #dbe5f2;padding-bottom:.35em}h2{font-size:1.65em}h3{font-size:1.3em}h4{font-size:1.15em}h5,h6{font-size:1em}
    .export-section>:first-child{margin-top:0}p{margin:.8em 0}a{color:#315acb;text-decoration:underline}img,svg,video{max-width:100%;height:auto}audio{max-width:100%}
    ul,ol{padding-left:1.6em}li{margin:.3em 0}li>p{margin:.25em 0}blockquote{border-left:3px solid #6685d2;background:#f3f6fc;margin:1em 0;padding:.4em 1em;border-radius:0 8px 8px 0}
    table{width:100%;border-collapse:collapse;margin:1em 0;table-layout:auto}th,td{border:${border};padding:.55em .7em;text-align:left;vertical-align:top}th{font-weight:bold;background:${s.tableStyle === 'minimal' ? 'transparent' : '#edf2fa'}}
    ${s.tableStyle === 'simple' ? 'td{border-left:0;border-right:0}tr:nth-child(even){background:#f8fafc}' : ''}
    pre{background:${codeBg};color:${s.codeStyle === 'dark' ? '#f8fafc' : '#1e293b'};padding:1em;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid;font-size:.85em}code{font-family:"Courier New",monospace}p code,li code{background:#eef2f8;padding:.1em .25em;border-radius:3px}
    hr{border:0;border-top:1px solid #d1dbea;margin:1.7em 0}thead{display:table-header-group}tr,img{break-inside:avoid}details{border:1px solid #d1dbea;border-radius:8px;padding:.7em}summary{font-weight:600}
    .export-section+.export-section{${s.linkedDocumentSeparation === 'new-page' ? 'break-before:page;margin-top:24mm' : 'margin-top:1.5em'}}
    .page-header{font-size:.8em;margin-bottom:12mm;white-space:pre-wrap}.page-footer{font-size:.8em;margin-top:12mm;text-align:${s.footer.alignment};white-space:pre-wrap}
    @page{size:${w}mm ${h}mm;margin:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;background:${s.pageColor};
      @top-center{content:${s.header.enabled ? cssString(s.header.text) : 'none'};font-family:${cssString(s.fontFamily)};font-size:9pt;white-space:pre-wrap}
      @bottom-${s.footer.alignment}{content:${s.footer.enabled ? footerContent : 'none'};font-family:${cssString(s.fontFamily)};font-size:9pt;white-space:pre-wrap}
    }
    @media print{html,body{background:${s.pageColor}}.paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.page-header,.page-footer{display:none}.export-section+.export-section{margin-top:${s.linkedDocumentSeparation === 'new-page' ? '0' : '1.5em'}}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  `
}

export function standaloneHtml(model: ExportModel, settings: ConversionSettings): string {
  const sections = exportSections(model, settings)
  // No source filename, application name or automatic title is inserted.
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: https: http:; media-src data: blob: https: http:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><title></title><style>${exportCss(settings)}</style></head><body><main class="export-document paper">${settings.header.enabled ? `<header class="page-header">${escapeHtml(settings.header.text)}</header>` : ''}${sections}${settings.footer.enabled ? `<footer class="page-footer">${escapeHtml(footerLabel(settings))}</footer>` : ''}</main></body></html>`
}

export function exportSections(model: ExportModel, settings: ConversionSettings): string {
  return model.documents.map((doc) => {
    const tree = structuredClone(doc.tree)
    if (!settings.documentCss) walkElements(tree, (node) => { delete node.properties.style })
    return `<section id="${doc.scope}" class="export-section">${settings.documentCss && doc.css ? `<style>${doc.css}</style>` : ''}${serializeTree(tree)}</section>`
  }).join('\n')
}

export async function printHtml(html: string): Promise<void> {
  const frame = document.createElement('iframe')
  frame.title = 'Print document'
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
  frame.style.cssText = 'position:fixed;width:1px;height:1px;bottom:0;right:0;border:0'
  document.body.append(frame)
  await new Promise<void>((resolve) => { frame.onload = () => resolve(); frame.srcdoc = html })
  const win = frame.contentWindow
  if (!win) { frame.remove(); throw new Error('Print preview could not open.') }
  await win.document.fonts.ready
  await Promise.all(Array.from(win.document.images).map((img) => img.complete ? Promise.resolve() : new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); setTimeout(resolve, 8000) })))
  win.addEventListener('afterprint', () => frame.remove(), { once: true })
  win.focus(); win.print()
  // Some browsers never emit afterprint after cancellation.
  setTimeout(() => frame.remove(), 120_000)
}
