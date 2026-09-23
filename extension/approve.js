import { HOST_PERMISSIONS } from './core.mjs'
const visit = new URL(location.href).searchParams.get('visit')
const allow = document.getElementById('allow')
const error = document.getElementById('error')
const send = action => chrome.runtime.sendMessage({ action, visit })
// Keep only the pending approval conversation alive while the user reads it.
const pendingTimer = setInterval(() => { void send('describe').then(result => { if (result?.error) { clearInterval(pendingTimer); allow.disabled = true; error.textContent = result.error } }).catch(() => clearInterval(pendingTimer)) }, 20000)
window.addEventListener('pagehide', () => clearInterval(pendingTimer))
send('describe').then(result => {
  if (result?.error || !result?.origin) throw new Error(result?.error || 'The requesting app is unavailable.')
  document.getElementById('origin').textContent = `Requesting app: ${result.origin}`
  allow.disabled = false
}).catch(reason => { error.textContent = reason.message })
allow.addEventListener('click', async () => {
  // Call inside the trusted extension button gesture, before any await.
  const permission = chrome.permissions.request(HOST_PERMISSIONS)
  allow.disabled = true; error.textContent = ''
  try {
    if (!await permission) throw new Error('Website access was not granted. You can still import local HTML or Word files.')
    const result = await send('allow')
    if (result?.error) throw new Error(result.error)
  } catch (reason) { error.textContent = reason.message; allow.disabled = false }
})
document.getElementById('deny').addEventListener('click', () => { void send('deny') })
