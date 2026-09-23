import { HOST_PERMISSIONS, isAppUrl, streamDownload } from './core.mjs'

const active = new Map()
const key = id => `visit:${id}`
const save = visit => chrome.storage.session.set({ [key(visit.id)]: { id: visit.id, tabId: visit.tabId, documentId: visit.documentId, origin: visit.origin, approved: visit.approved } })
const post = (visit, message) => { try { visit.port.postMessage(message) } catch { /* disconnected */ } }

async function revoke(visit) {
  visit.generation++
  visit.approved = false
  for (const job of visit.jobs.values()) job.controller.abort()
  await save(visit)
  post(visit, { type: 'status', approved: false })
}

async function closePrompt(visit, error = 'URL import permission was cancelled.') {
  const pending = visit.pending
  visit.pending = null
  if (!pending) return
  if (error) post(visit, { id: pending.id, type: 'error', error })
  if (pending.windowId !== undefined) await chrome.windows.remove(pending.windowId).catch(() => {})
}

async function receive(visit, message) {
  const { id, action } = message
  if (action === 'leave') {
    await revoke(visit); await closePrompt(visit)
    await chrome.storage.session.remove(key(visit.id)); active.delete(visit.id)
    return
  }
  if (typeof id !== 'string' || id.length > 100) return
  const result = () => post(visit, { id, type: 'result', installed: true, approved: visit.approved })
  if (action === 'status') { result(); return }
  if (action === 'revoke') { await revoke(visit); await closePrompt(visit); result(); return }
  if (action === 'authorize') {
    if (visit.approved && await chrome.permissions.contains(HOST_PERMISSIONS)) { result(); return }
    if (visit.pending) { post(visit, { id, type: 'error', error: 'An approval window is already open. Finish or close it first.' }); return }
    visit.pending = { id }
    try {
      const popup = await chrome.windows.create({ url: chrome.runtime.getURL(`approve.html?visit=${encodeURIComponent(visit.id)}`), type: 'popup', width: 500, height: 530, focused: true })
      if (visit.pending?.id === id) visit.pending.windowId = popup.id
      else if (popup.id !== undefined) await chrome.windows.remove(popup.id).catch(() => {})
    } catch { await closePrompt(visit, 'Could not open extension approval. Check your browser extension settings.') }
    return
  }
  if (action === 'cancel') {
    visit.jobs.get(message.requestId)?.controller.abort()
    if (visit.pending?.id === message.requestId) await closePrompt(visit)
    return
  }
  if (action === 'ack') { visit.jobs.get(message.requestId)?.ack?.(); return }
  if (action !== 'download') return
  try {
    const generation = visit.generation
    const permitted = await chrome.permissions.contains(HOST_PERMISSIONS)
    if (!visit.approved || !permitted || visit.generation !== generation || active.get(visit.id) !== visit) throw new Error('Enable URL imports for this app visit first.')
    if (visit.jobs.has(id) || visit.jobs.size >= 5 || message.kind === 'page' && [...visit.jobs.values()].some(job => job.kind === 'page')) throw new Error('Another import is running. Wait for it to finish.')
    const job = { kind: message.kind, controller: new AbortController(), ack: null }
    visit.jobs.set(id, job)
    const timeout = setTimeout(() => job.controller.abort(), 185000)
    try {
      await streamDownload(message.url, message.kind, job.controller.signal, async chunk => {
        if (chunk.type !== 'chunk') { post(visit, { ...chunk, id }); return }
        await new Promise((resolve, reject) => {
          const stop = () => { cleanup(); reject(new Error('Import stopped.')) }
          const timer = setTimeout(stop, 30000)
          const cleanup = () => { clearTimeout(timer); job.controller.signal.removeEventListener('abort', stop); job.ack = null }
          job.ack = () => { cleanup(); resolve() }
          job.controller.signal.addEventListener('abort', stop, { once: true })
          post(visit, { ...chunk, id })
        })
      })
    } finally { clearTimeout(timeout); visit.jobs.delete(id) }
  } catch (error) {
    post(visit, { id, type: 'error', error: error.name === 'AbortError' || error.name === 'TimeoutError' ? 'Import stopped or timed out.' : error.message || 'The website could not be downloaded.' })
  }
}

chrome.runtime.onConnect.addListener(port => {
  const sender = port.sender
  if (port.name !== 'um-import-page' || sender?.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.documentId || !sender.tab?.id || !isAppUrl(sender.url)) { port.disconnect(); return }
  let visit
  let ready = Promise.resolve()
  port.onMessage.addListener(message => {
    if (message.action === 'hello') {
      ready = (async () => {
        if (visit) return
        const stored = typeof message.session === 'string' ? (await chrome.storage.session.get(key(message.session)))[key(message.session)] : null
        const restored = stored?.tabId === sender.tab.id && stored?.documentId === sender.documentId
        visit = { id: restored ? stored.id : crypto.randomUUID(), tabId: sender.tab.id, documentId: sender.documentId, origin: new URL(sender.url).origin, approved: restored && stored.approved && await chrome.permissions.contains(HOST_PERMISSIONS), port, jobs: new Map(), pending: null, generation: 0 }
        active.set(visit.id, visit)
        await save(visit)
        post(visit, { type: 'session', session: visit.id })
        post(visit, { type: 'status', installed: true, approved: !!visit.approved })
      })().catch(() => port.disconnect())
    } else void ready.then(() => visit && receive(visit, message)).catch(() => post(visit, { id: message.id, type: 'error', error: 'Extension connection failed. Reload the app after saving.' }))
  })
  port.onDisconnect.addListener(() => {
    if (!visit) return
    visit.generation++
    for (const job of visit.jobs.values()) job.controller.abort()
    void closePrompt(visit)
    if (active.get(visit.id) === visit) active.delete(visit.id)
    // Preserve only approval for this exact document across service-worker idle
    // restarts. New documents never receive this isolated-world session token.
  })
})

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('approve.html') + '?')) return
  const visit = active.get(message.visit)
  if (!visit?.pending) { respond({ error: 'This visit has ended. Return to the app and try again.' }); return }
  if (message.action === 'describe') { respond({ origin: visit.origin }); return }
  if (!['allow', 'deny'].includes(message.action)) return
  const pending = visit.pending, generation = visit.generation
  void (async () => {
    if (message.action === 'allow' && await chrome.permissions.contains(HOST_PERMISSIONS)) {
      if (active.get(visit.id) !== visit || visit.pending !== pending || visit.generation !== generation) { respond({ error: 'This approval request has ended.' }); return }
      visit.approved = true
      await save(visit)
      if (visit.pending !== pending || visit.generation !== generation) { respond({ error: 'This approval request has ended.' }); return }
      post(visit, { id: pending.id, type: 'result', installed: true, approved: true })
      post(visit, { type: 'status', approved: true })
      respond({ ok: true })
      await closePrompt(visit, null)
      await chrome.tabs.update(visit.tabId, { active: true }).catch(() => {})
    } else { respond({ ok: true }); await closePrompt(visit) }
  })().catch(() => respond({ error: 'Could not grant permission. Return to the app and try again.' }))
  return true
})

chrome.windows.onRemoved.addListener(windowId => {
  for (const visit of active.values()) if (visit.pending?.windowId === windowId) void closePrompt(visit)
})
chrome.tabs.onRemoved.addListener(tabId => {
  void chrome.storage.session.get(null).then(entries => chrome.storage.session.remove(Object.keys(entries).filter(name => name.startsWith('visit:') && entries[name].tabId === tabId)))
})
chrome.permissions.onRemoved.addListener(() => { for (const visit of active.values()) void revoke(visit) })
