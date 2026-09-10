import type { Root, Element, RootContent } from 'hast'
declare module 'hast' { interface RootData { documentCss?: string } }

// Allow document presentation, never network requests, global rules or overlays.
const properties = /^(color|background-color|font(-family|-size|-weight|-style|-variant)?|line-height|letter-spacing|word-spacing|text-align|text-decoration(-line|-color|-style)?|text-transform|white-space|overflow-wrap|word-break|padding(-top|-right|-bottom|-left)?|margin(-top|-right|-bottom|-left)?|border(-top|-right|-bottom|-left)?(-width|-style|-color)?|border(-top-left|-top-right|-bottom-left|-bottom-right)?-radius|border-collapse|border-spacing|width|max-width|min-width|height|max-height|min-height|display|vertical-align|list-style-type|list-style-position|gap|row-gap|column-gap|grid-template-columns|flex-wrap|justify-content|align-items|box-shadow|box-sizing|overflow(-x|-y)?|(page-)?break-before|(page-)?break-after|(page-)?break-inside)$/
export function safeDeclarations(input: string): string {
  const style = document.createElement('span').style
  style.cssText = input
  return Array.from(style).flatMap((name) => {
    const value = style.getPropertyValue(name)
    if (!properties.test(name) || /url\s*\(|image\s*\(|image-set|var\s*\(|attr\s*\(|expression|\\|[<>]/i.test(value)) return []
    if (name.startsWith('margin') && /-\d/.test(value)) return []
    return [name + ':' + value]
  }).join(';')
}
export function scopeDocumentCss(input: string, scope: string): string {
  if (typeof CSSStyleSheet === 'undefined' || input.length > 200_000) return ''
  const sheet = new CSSStyleSheet()
  try { sheet.replaceSync(input) } catch { return '' }
  const walk = (rules: CSSRuleList): string => Array.from(rules).map((rule): string => {
    if (rule instanceof CSSStyleRule) {
      const body = safeDeclarations(rule.style.cssText)
      if (!body) return ''
      const selector = rule.selectorText
      if (/[<>\\]|:host|::part|::slotted/i.test(selector)) return ''
      const normalized = selector.replace(/(^|[\s,>+~])(html|body|:root)(?=[\s,.#:[>+~]|$)/gi, (_match, prefix: string) => prefix + scope)
      // Complete selector list stays within :is, including commas inside functions.
      return scope + ':is(' + normalized + '),' + scope + ' :is(' + normalized + '){' + body + '}'
    }
    if (rule instanceof CSSMediaRule && !/[<>\\]/.test(rule.conditionText)) return '@media ' + rule.conditionText + '{' + walk(rule.cssRules) + '}'
    if (rule instanceof CSSSupportsRule && !/[<>\\]/.test(rule.conditionText)) return '@supports ' + rule.conditionText + '{' + walk(rule.cssRules) + '}'
    return ''
  }).join('\n')
  return walk(sheet.cssRules)
}
export function documentStylePlugin(options: { scope: string; collect?: (css: string) => void }) {
  return (tree: Root) => {
    const styles: string[] = []
    const walk = (parent: Root | Element) => {
      parent.children = parent.children.filter((node: RootContent) => {
        if (node.type !== 'element') return true
        if (node.tagName === 'style') {
          styles.push(node.children.filter((child) => child.type === 'text').map((child) => child.value).join(''))
          return false
        }
        if (typeof node.properties.style === 'string') node.properties.style = safeDeclarations(node.properties.style)
        walk(node); return true
      }) as typeof parent.children
    }
    walk(tree)
    const css = scopeDocumentCss(styles.join('\n'), options.scope)
    options.collect?.(css)
    tree.data = { ...tree.data, documentCss: css }
  }
}
export function appendDocumentCss() {
  return (tree: Root) => {
    const css = tree.data?.documentCss
    if (typeof css === 'string' && css) tree.children.unshift({ type: 'element', tagName: 'style', properties: {}, children: [{ type: 'text', value: css }] })
  }
}
