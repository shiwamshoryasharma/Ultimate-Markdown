export function isRemoteUrl(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')
}

export function resolveDocumentPath(base: string, href: string): string | null {
  if (!href || href.startsWith('#') || isRemoteUrl(href)) return null
  let path: string
  try { path = decodeURIComponent(href.split(/[?#]/)[0]).replaceAll('\\', '/') } catch { return null }
  const stack = path.startsWith('/') ? [] : base.split('/').slice(0, -1)
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') { if (!stack.length) return null; stack.pop() }
    else stack.push(segment)
  }
  return stack.join('/')
}

export function markdownTarget(base: string, href: string): string | null {
  const path = resolveDocumentPath(base, href)
  return path && /\.(md|markdown)$/i.test(path) ? path : null
}
