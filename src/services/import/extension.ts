const CHANNEL = 'ultimate-markdown-extension'
export interface ExtensionStatus { installed: boolean; approved: boolean; checking: boolean }
let status: ExtensionStatus = { installed: false, approved: false, checking: true }
const listeners = new Set<() => void>()
const receivers = new Map<string, (message: Record<string, unknown>) => void>()
let approval: Promise<void> | null = null

function update(patch: Partial<ExtensionStatus>) {
  status = { ...status, ...patch }
  listeners.forEach(listener => listener())
}
export const getExtensionStatus = () => status
export const subscribeExtension = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

function send(action: string, id: string, fields: Record<string, unknown> = {}) {
  window.postMessage({ channel: CHANNEL, direction: 'request', action, id, ...fields }, window.location.origin)
}
window.addEventListener('message', event => {
  const message = event.data
  if (event.source !== window || event.origin !== window.location.origin || !message || message.channel !== CHANNEL || message.direction !== 'response') return
  if (message.type === 'status' || message.type === 'result' && typeof message.approved === 'boolean') update({ installed: true, approved: message.approved === true, checking: false })
  if (message.type === 'disconnected') {
    update({ approved: false })
    for (const receive of receivers.values()) receive({ type: 'error', error: 'The extension disconnected. Retry to reconnect; save your work before reloading the app.' })
  }
  if (typeof message.id === 'string') receivers.get(message.id)?.(message)
})
window.addEventListener('pagehide', () => { update({ approved: false }); approval = null })

function exchange<T>(action: string, fields: Record<string, unknown>, consume: (message: Record<string, unknown>, id: string) => T | undefined, timeout: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Import stopped.')); return }
    const id = crypto.randomUUID()
    const cleanup = () => { receivers.delete(id); clearTimeout(timer); signal?.removeEventListener('abort', stop) }
    const fail = (error: Error) => { cleanup(); send('cancel', crypto.randomUUID(), { requestId: id }); reject(error) }
    const stop = () => fail(new Error('Import stopped.'))
    const timer = window.setTimeout(() => fail(new Error(action === 'status' ? 'Install the Ultimate Markdown companion extension, then reload this app after saving your work.' : 'Extension request timed out. Please try again.')), timeout)
    receivers.set(id, message => {
      try {
        if (message.type === 'error') throw new Error(String(message.error || 'Extension request failed.'))
        const value = consume(message, id)
        if (value !== undefined) { cleanup(); resolve(value) }
      } catch (error) { fail(error instanceof Error ? error : new Error(String(error))) }
    })
    signal?.addEventListener('abort', stop, { once: true })
    send(action, id, fields)
  })
}

export async function checkExtension(): Promise<ExtensionStatus> {
  try {
    await exchange('status', {}, message => message.type === 'result' ? true : undefined, 2000)
  } catch { update({ installed: false, approved: false, checking: false }) }
  return status
}

export async function authorizeExtension(signal?: AbortSignal): Promise<void> {
  if (approval) return approval
  approval = (async () => {
    const current = await checkExtension()
    if (signal?.aborted) throw new Error('Import stopped.')
    if (!current.installed) throw new Error('Install the Ultimate Markdown companion extension to import URLs. Local HTML and Word files work without it.')
    if (current.approved) return
    await exchange('authorize', {}, message => {
      if (message.type !== 'result') return undefined
      if (!message.approved) throw new Error('URL import permission was not granted.')
      return true
    }, 120000, signal)
  })().finally(() => { approval = null })
  return approval
}

export async function revokeExtension(): Promise<void> {
  await exchange('revoke', {}, message => message.type === 'result' ? true : undefined, 5000)
  update({ approved: false })
}

export async function downloadWithExtension(url: string, kind: 'page' | 'image', signal: AbortSignal): Promise<{ url: string; blob: Blob }> {
  await authorizeExtension(signal)
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let total = 0, finalUrl = '', mime = ''
  const maximum = (kind === 'page' ? 200 : 2) * 1024 * 1024
  return exchange('download', { url, kind }, (message, id) => {
    if (message.type === 'start') {
      if (finalUrl) throw new Error('Invalid extension response.')
      finalUrl = String(message.url || url); mime = String(message.mime || '')
      if (!(kind === 'page' ? /^(text\/html|application\/xhtml\+xml)(;|$)/i : /^image\/(png|jpeg|gif|webp)(;|$)/i).test(mime)) throw new Error('The source returned an unsupported document type.')
    } else if (message.type === 'chunk') {
      if (!finalUrl || typeof message.data !== 'string' || message.data.length > 350000) throw new Error('Invalid extension download chunk.')
      const binary = atob(message.data)
      total += binary.length
      if (total > maximum) throw new Error(`This ${kind === 'page' ? 'page exceeds the 200' : 'image exceeds the 2'} MiB import limit.`)
      chunks.push(Uint8Array.from(binary, char => char.charCodeAt(0)))
      send('ack', crypto.randomUUID(), { requestId: id })
    } else if (message.type === 'end') {
      if (!finalUrl) throw new Error('The extension returned no document.')
      return { url: finalUrl, blob: new Blob(chunks, { type: mime }) }
    }
    return undefined
  }, 190000, signal)
}
