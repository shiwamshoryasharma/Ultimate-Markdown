export const HOST_PERMISSIONS = { origins: ['https://*/*', 'http://*/*'] }

export function isAppUrl(value) {
  try {
    const url = new URL(value)
    return ['https://ultimate-markdown.web.app', 'https://ultimate-markdown.firebaseapp.com'].includes(url.origin) ||
      url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && ['5173', '4173', '5174', '4174'].includes(url.port)
  } catch { return false }
}

export function validateDownloadUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Enter a public webpage URL.')
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port ||
      !host.includes('.') || host.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.endsWith('.') ||
      /(?:^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host)) {
    throw new Error('Only public HTTP/HTTPS websites on standard ports, without credentials or IP addresses, can be imported.')
  }
  url.hash = ''
  return url
}

function base64(bytes) {
  let text = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return btoa(text)
}

// Bounded, acknowledged chunks avoid Chrome's per-message size limit. Nothing
// is written to storage; the existing webpage worker still prepares the HTML.
export async function streamDownload(value, kind, signal, send, fetchResource = fetch) {
  signal.throwIfAborted()
  if (!['page', 'image'].includes(kind)) throw new Error('Unsupported download type.')
  const url = validateDownloadUrl(value)
  const maximum = (kind === 'page' ? 200 : 2) * 1024 * 1024
  const sizeError = () => new Error(`This ${kind === 'page' ? 'page exceeds the 200' : 'image exceeds the 2'} MiB import limit.`)
  const response = await fetchResource(url.href, {
    credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
  })
  let reader
  try {
    if (!response.ok) throw new Error(`The source website returned HTTP ${response.status}. It may require login or block downloads.`)
    const finalUrl = validateDownloadUrl(response.url || url.href).href
    const mime = response.headers.get('content-type') || ''
    if (!(kind === 'page' ? /^(text\/html|application\/xhtml\+xml)(;|$)/i : /^image\/(png|jpeg|gif|webp)(;|$)/i).test(mime)) throw new Error(kind === 'page' ? 'This URL does not return an HTML webpage.' : 'This image format cannot be embedded.')
    if (Number(response.headers.get('content-length')) > maximum) throw sizeError()
    reader = response.body?.getReader()
    if (!reader) throw new Error('The website returned an empty response.')
    await send({ type: 'start', url: finalUrl, mime })
    let total = 0
    while (true) {
      signal.throwIfAborted()
      const { done, value: bytes } = await reader.read()
      if (done) break
      total += bytes.length
      if (total > maximum) throw sizeError()
      for (let offset = 0; offset < bytes.length; offset += 256 * 1024) {
        signal.throwIfAborted()
        await send({ type: 'chunk', data: base64(bytes.subarray(offset, offset + 256 * 1024)) })
      }
    }
    await send({ type: 'end' })
  } finally {
    if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock() }
    else await response.body?.cancel().catch(() => {})
  }
}
