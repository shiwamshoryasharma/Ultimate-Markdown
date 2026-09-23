import test from 'node:test'
import assert from 'node:assert/strict'

const extensionId = 'test-companion-id'
const appUrl = 'https://ultimate-markdown.web.app/import'
const extensionUrl = path => `chrome-extension://${extensionId}/${path}`
const tick = () => new Promise(resolve => setImmediate(resolve))

function event() {
  const listeners = []
  return { addListener(listener) { listeners.push(listener) }, emit(...args) { return listeners.map(listener => listener(...args)) } }
}

async function until(check, label) {
  for (let n = 0; n < 100; n++) { if (check()) return; await tick() }
  assert.fail(`Did not observe ${label}`)
}

async function harness(t) {
  const previousChrome = globalThis.chrome, previousFetch = globalThis.fetch
  const entries = {}, ports = [], popups = [], downloads = []
  let permission = true, nextWindow = 100, counter = 0, holdFetch = false, pendingPermissionCheck
  const chrome = {
    runtime: { id: extensionId, getURL: extensionUrl, onConnect: event(), onMessage: event() },
    storage: { session: {
      async get(key) { return structuredClone(key === null ? entries : { [key]: entries[key] }) },
      async set(value) { Object.assign(entries, structuredClone(value)) },
      async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete entries[key] },
    } },
    permissions: { async contains() { if (pendingPermissionCheck) { const check = pendingPermissionCheck; pendingPermissionCheck = undefined; return check } return permission }, onRemoved: event() },
    windows: {
      onRemoved: event(),
      async create(options) { const popup = { ...options, id: nextWindow++ }; popups.push(popup); return popup },
      async remove(id) { chrome.windows.onRemoved.emit(id) },
    },
    tabs: { onRemoved: event(), async update() {} },
  }
  globalThis.chrome = chrome
  globalThis.fetch = async (url, options) => {
    const download = { url, signal: options.signal, aborted: false }
    downloads.push(download)
    options.signal.addEventListener('abort', () => { download.aborted = true }, { once: true })
    if (holdFetch) return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
    return new Response('<main><h1>Downloaded</h1></main>', { headers: { 'Content-Type': 'text/html' } })
  }
  await import(`../extension/background.mjs?test=${crypto.randomUUID()}`)
  t.after(async () => {
    for (const port of ports) port.disconnect()
    await tick()
    globalThis.chrome = previousChrome
    globalThis.fetch = previousFetch
  })
  function connect(sender = {}, name = 'um-import-page') {
    const port = {
      name, sender: { id: extensionId, frameId: 0, documentId: 'document-1', tab: { id: 7 }, url: appUrl, ...sender },
      messages: [], disconnected: false, onMessage: event(), onDisconnect: event(),
      postMessage(message) { this.messages.push(message); if (message.type === 'chunk') queueMicrotask(() => this.onMessage.emit({ id: `ack-${++counter}`, action: 'ack', requestId: message.id })) },
      disconnect() { if (!this.disconnected) { this.disconnected = true; this.onDisconnect.emit() } },
      send(message) { this.onMessage.emit(message) },
    }
    ports.push(port)
    chrome.runtime.onConnect.emit(port)
    return port
  }
  async function hello(port, session) {
    const previous = port.messages.length
    port.send({ action: 'hello', session })
    await until(() => port.messages.slice(previous).some(message => message.type === 'session'), 'session handshake')
    return port.messages.slice(previous).find(message => message.type === 'session').session
  }
  async function request(port, action, extra = {}) {
    const id = `request-${++counter}`
    port.send({ id, action, ...extra })
    await until(() => port.messages.some(message => message.id === id && ['result', 'error', 'end'].includes(message.type)), `${action} response`)
    return port.messages.find(message => message.id === id && ['result', 'error', 'end'].includes(message.type))
  }
  async function authorize(port) {
    const id = `authorize-${++counter}`, previous = popups.length
    port.send({ id, action: 'authorize' })
    await until(() => popups.length > previous, 'approval popup')
    await tick()
    return { id, popup: popups.at(-1), visit: new URL(popups.at(-1).url).searchParams.get('visit') }
  }
  async function decision(prompt, action = 'allow', sender = { id: extensionId, url: prompt.popup.url }) {
    let response
    chrome.runtime.onMessage.emit({ action, visit: prompt.visit }, sender, value => { response = value })
    await tick(); await tick()
    return response
  }
  async function approve(port) {
    const prompt = await authorize(port)
    assert.deepEqual(await decision(prompt), { ok: true })
    assert.equal((await request(port, 'status')).approved, true)
    return prompt
  }
  return { chrome, connect, hello, request, authorize, decision, approve, downloads, popups, entries,
    permission(value) { permission = value }, holdDownloads() { holdFetch = true },
    deferPermissionCheck() { let resolve; pendingPermissionCheck = new Promise(done => { resolve = done }); return resolve } }
}

test('only the top-level allowed app from this extension can connect', async t => {
  const h = await harness(t)
  for (const sender of [
    { url: 'https://evil.example/import' }, { url: 'https://ultimate-markdown.web.app.evil.example/import' },
    { frameId: 1 }, { id: 'another-extension' }, { documentId: undefined }, { tab: undefined },
  ]) assert.equal(h.connect(sender).disconnected, true)
  assert.equal(h.connect({}, 'other-port').disconnected, true)
  const port = h.connect()
  await h.hello(port)
  assert.equal((await h.request(port, 'status')).approved, false)
})

test('page messages cannot approve themselves and downloads require approval', async t => {
  const h = await harness(t), port = h.connect()
  const visit = await h.hello(port)
  port.send({ id: 'forged-allow', action: 'allow', approved: true, visit })
  port.send({ id: 'forged-status', action: 'status', approved: true })
  assert.match((await h.request(port, 'download', { url: 'https://example.com/', kind: 'page' })).error, /Enable URL imports/)
  const prompt = await h.authorize(port)
  assert.equal(await h.decision(prompt, 'allow', { id: extensionId, url: appUrl }), undefined)
  assert.equal(await h.decision(prompt, 'allow', { id: 'other-extension', url: prompt.popup.url }), undefined)
  assert.equal((await h.request(port, 'status')).approved, false)
  assert.equal(h.downloads.length, 0)
})

test('trusted approval requires actual browser host permission before granting the visit', async t => {
  const h = await harness(t), port = h.connect()
  await h.hello(port)
  h.permission(false)
  const prompt = await h.authorize(port)
  await h.decision(prompt)
  assert.equal((await h.request(port, 'status')).approved, false)
  assert.ok(port.messages.some(message => message.id === prompt.id && message.type === 'error'))
  h.permission(true)
  await h.approve(port)
  assert.equal((await h.request(port, 'download', { url: 'https://example.com/', kind: 'page' })).type, 'end')
  assert.equal(h.downloads.length, 1)
})

test('same-document reconnect restores permission while another document or tab cannot reuse it', async t => {
  const h = await harness(t), original = h.connect()
  const session = await h.hello(original)
  await h.approve(original)
  original.disconnect()
  await tick()
  const reconnected = h.connect()
  assert.equal(await h.hello(reconnected, session), session)
  assert.equal((await h.request(reconnected, 'status')).approved, true)
  for (const sender of [{ documentId: 'document-after-reload' }, { tab: { id: 8 } }]) {
    const other = h.connect(sender)
    assert.notEqual(await h.hello(other, session), session)
    assert.equal((await h.request(other, 'status')).approved, false)
    assert.match((await h.request(other, 'download', { url: 'https://example.com/', kind: 'page' })).error, /Enable URL imports/)
  }
  assert.equal(h.downloads.length, 0)
})

for (const action of ['revoke', 'leave']) test(`${action} aborts downloads and prevents restoration of the old grant`, async t => {
  const h = await harness(t), port = h.connect()
  const session = await h.hello(port)
  await h.approve(port)
  h.holdDownloads()
  port.send({ id: 'active-download', action: 'download', url: 'https://example.com/', kind: 'page' })
  await until(() => h.downloads.length === 1, 'download start')
  if (action === 'revoke') await h.request(port, action)
  else { port.send({ action }); await tick(); await tick() }
  await until(() => h.downloads[0].aborted, 'download abort')
  await until(() => port.messages.some(message => message.id === 'active-download' && message.type === 'error'), 'cancelled download result')
  port.disconnect()
  const reconnected = h.connect()
  await h.hello(reconnected, session)
  assert.equal((await h.request(reconnected, 'status')).approved, false)
})

test('closing the approval popup declines the request and permits a fresh request', async t => {
  const h = await harness(t), port = h.connect()
  await h.hello(port)
  const prompt = await h.authorize(port)
  h.chrome.windows.onRemoved.emit(prompt.popup.id)
  await until(() => port.messages.some(message => message.id === prompt.id && message.type === 'error'), 'declined approval')
  assert.equal((await h.request(port, 'status')).approved, false)
  await h.approve(port)
})

test('removing browser permission revokes an active visit and cancels its download', async t => {
  const h = await harness(t), port = h.connect()
  await h.hello(port)
  await h.approve(port)
  h.holdDownloads()
  port.send({ id: 'active-download', action: 'download', url: 'https://example.com/', kind: 'page' })
  await until(() => h.downloads.length === 1, 'download start')
  h.permission(false)
  h.chrome.permissions.onRemoved.emit({ origins: ['https://*/*'] })
  await until(() => h.downloads[0].aborted, 'permission removal abort')
  assert.equal((await h.request(port, 'status')).approved, false)
})

test('closing approval during a pending browser permission check cannot grant a closed request', async t => {
  const h = await harness(t), port = h.connect()
  await h.hello(port)
  const prompt = await h.authorize(port)
  const finishPermissionCheck = h.deferPermissionCheck()
  await h.decision(prompt)
  h.chrome.windows.onRemoved.emit(prompt.popup.id)
  await until(() => port.messages.some(message => message.id === prompt.id && message.type === 'error'), 'closed approval result')
  finishPermissionCheck(true)
  await tick(); await tick()
  assert.equal((await h.request(port, 'status')).approved, false, 'a stale allow decision must not restore approval')
})

test('revocation while a download checks browser permission prevents the download starting', async t => {
  const h = await harness(t), port = h.connect()
  await h.hello(port)
  await h.approve(port)
  const finishPermissionCheck = h.deferPermissionCheck()
  port.send({ id: 'pending-download', action: 'download', url: 'https://example.com/', kind: 'page' })
  await tick()
  await h.request(port, 'revoke')
  finishPermissionCheck(true)
  await until(() => port.messages.some(message => message.id === 'pending-download' && ['end', 'error'].includes(message.type)), 'pending download response')
  assert.equal(h.downloads.length, 0, 'a revoked visit must not start retrieval after permission check completes')
})
