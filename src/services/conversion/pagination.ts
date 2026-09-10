import runtimeUrl from '../../../node_modules/pagedjs/dist/paged.polyfill.js?url'
import type { ConversionSettings } from '@/types/conversion'
import { pageDimensions } from '@/types/conversion'
import type { ExportModel } from './model'
import { exportCss, exportSections } from './html'

interface PagedWindow extends Window {
  PagedConfig: { auto: boolean }
  PagedPolyfill: { preview: (content: string, styles: Record<string, string>[], target: HTMLElement) => Promise<{ total: number }> }
}

/** Paged.js splits selector lists at commas, including commas inside :is().
 * Resolve scoped document selectors to stable classes before handing them over. */
function paginationDocumentCss(parsed: Document, css: string): string {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  let index = 0
  const walk = (rules: CSSRuleList): string => Array.from(rules).map((rule): string => {
    if (rule instanceof CSSStyleRule) {
      const name = `um-page-rule-${index++}`
      let elements: NodeListOf<Element>
      try { elements = parsed.querySelectorAll(rule.selectorText) } catch { return '' }
      for (const element of elements) element.classList.add(name)
      return elements.length ? `.${name}{${rule.style.cssText}}` : ''
    }
    if (rule instanceof CSSMediaRule) return `@media ${rule.conditionText}{${walk(rule.cssRules)}}`
    if (rule instanceof CSSSupportsRule) return `@supports ${rule.conditionText}{${walk(rule.cssRules)}}`
    return ''
  }).join('\n')
  return walk(sheet.cssRules)
}

/** The engine and all document styles live in a disposable iframe realm. */
export async function paginate(frame: HTMLIFrameElement, model: ExportModel, settings: ConversionSettings): Promise<number> {
  await new Promise<void>((resolve) => {
    frame.onload = () => resolve()
    frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; img-src data: blob: https: http:; style-src 'unsafe-inline'; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"></head><body><div id="pages"></div></body></html>`
  })
  const win = frame.contentWindow as PagedWindow | null
  if (!win) throw new Error('Page preview could not open.')
  win.PagedConfig = { auto: false }
  await new Promise<void>((resolve, reject) => {
    const script = win.document.createElement('script')
    script.src = runtimeUrl
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load the page preview. Please reload and try again.'))
    win.document.head.append(script)
  })
  const sections = exportSections(model, settings)
  // Feed scoped document CSS to the paginator, never to the application document.
  const parsed = new DOMParser().parseFromString(sections, 'text/html')
  const inlineRules = Array.from(parsed.querySelectorAll<HTMLElement>('[style]')).map((el, index) => {
    const name = `um-inline-${index}`
    el.classList.add(name)
    const css = el.style.cssText
    el.removeAttribute('style')
    return `.${name}{${css}}`
  }).join('\n')
  const documentCss = paginationDocumentCss(parsed, Array.from(parsed.querySelectorAll('style')).map((el) => { const css = el.textContent; el.remove(); return css }).join('\n') + '\n' + inlineRules)
  const css = `${exportCss(settings)}\n${documentCss}\n.paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none;background:transparent}.export-section+.export-section{margin-top:${settings.linkedDocumentSeparation === 'new-page' ? '0' : '1.5em'}} .pagedjs_page{background:${settings.pageColor}}`
  const flow = await win.PagedPolyfill.preview(`<main class="export-document">${parsed.body.innerHTML}</main>`, [{ 'export.css': css }], win.document.getElementById('pages')!)
  const [width, height] = pageDimensions(settings)
  const presentation = win.document.createElement('style')
  presentation.textContent = `html,body{margin:0;background:#e5e9f1}#pages{padding:18px 0}.pagedjs_page{margin:0 auto 20px;box-shadow:0 4px 18px #16203c22;background:${settings.pageColor}}.pagedjs_pagebox{background:${settings.pageColor}}@media print{@page{size:${width}mm ${height}mm;margin:0!important}html,body{background:${settings.pageColor}}#pages{padding:0;zoom:1!important}.pagedjs_page{margin:0!important;box-shadow:none;break-after:page}.pagedjs_page:last-child{break-after:auto}}`
  win.document.head.append(presentation)
  await win.document.fonts.ready
  return flow.total
}
