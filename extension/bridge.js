// Runs only on the app's pages. The worker independently checks the sender URL,
// top-level frame and document identity; page messages cannot approve a session.
(() => {
  const channel = 'ultimate-markdown-extension'
  if (window !== window.top) return
  let port = null
  let session = null
  const allowed = new Set(['status', 'authorize', 'download', 'ack', 'cancel', 'revoke'])
  const reply = data => window.postMessage({ ...data, channel, direction: 'response' }, location.origin)
  function connect() {
    if (port) return port
    port = chrome.runtime.connect({ name: 'um-import-page' })
    port.onMessage.addListener(message => {
      if (message.type === 'session') { session = message.session; return }
      reply(message)
    })
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError
      port = null
      reply({ type: 'disconnected' })
    })
    port.postMessage({ action: 'hello', session })
    return port
  }
  window.addEventListener('message', event => {
    const message = event.data
    if (event.source !== window || event.origin !== location.origin || !message || message.channel !== channel || message.direction !== 'request' || !allowed.has(message.action) || typeof message.id !== 'string' || message.id.length > 100) return
    try { connect().postMessage({ id: message.id, action: message.action, url: message.url, kind: message.kind, requestId: message.requestId }) }
    catch { reply({ id: message.id, type: 'error', error: 'Reconnect the extension by reloading this app after saving your work.' }) }
  })
  window.addEventListener('pagehide', () => {
    try { port?.postMessage({ action: 'leave' }); port?.disconnect() } catch { /* tab closing */ }
    port = null; session = null
  })
  window.addEventListener('pageshow', () => { reply({ type: 'status', approved: false }); connect() })
  connect()
})()
