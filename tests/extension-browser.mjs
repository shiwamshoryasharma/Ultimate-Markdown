import { chromium, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile, stat, mkdtemp, cp, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Opt-in real-extension smoke. Uses an isolated test profile, never the user's
// browser. Run after build with PLAYWRIGHT_BROWSERS_PATH and Chromium installed.
const root = path.resolve('web')
let extension = path.resolve('extension')
const profile = await mkdtemp(path.resolve('.tmp/extension-profile-'))
const app = process.env.EXTENSION_APP_URL || 'http://127.0.0.1:4174/#/import'
let server, context
try {
  if (process.env.EXTENSION_PREGRANTED_TEST === '1') {
    // Browser-owned installation/permission UI is outside Playwright's DOM.
    // This isolated fixture models a user who already granted host permission;
    // all companion code and every per-visit approval remain real and unchanged.
    const fixture = await mkdtemp(path.resolve('.tmp/extension-pregranted-'))
    await cp(extension, fixture, { recursive: true })
    const manifest = JSON.parse(await readFile(path.join(fixture, 'manifest.json'), 'utf8'))
    manifest.host_permissions = manifest.optional_host_permissions
    delete manifest.optional_host_permissions
    await writeFile(path.join(fixture, 'manifest.json'), JSON.stringify(manifest))
    extension = fixture
    console.log('Test fixture: browser host access pregranted; real per-visit consent still required.')
  }
  if (!process.env.EXTENSION_APP_URL) {
    server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost')
        const file = path.resolve(root, '.' + decodeURIComponent(url.pathname), url.pathname.endsWith('/') ? 'index.html' : '')
        if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile()) throw new Error('Not found')
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.zip': 'application/zip' }
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(await readFile(file))
      } catch { res.writeHead(404); res.end('Not found') }
    })
    await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve))
  }
  context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: process.env.EXTENSION_HEADLESS !== '0', args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] })
  const page = await context.newPage()
  const errors = [], apiRequests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/import') apiRequests.push(request.url()) })
  await page.goto(app)
  const enable = page.getByRole('button', { name: 'Enable URL imports', exact: true })
  await expect(enable).toBeEnabled({ timeout: 15000 })
  const popupEvent = context.waitForEvent('page')
  await enable.click()
  const popup = await popupEvent
  await popup.waitForLoadState()
  console.log('Approval window:', popup.url())
  await expect(popup.getByRole('heading', { name: 'Allow URL imports for this visit?' })).toBeVisible()
  await popup.screenshot({ path: '.tmp/extension-approval.png' })
  await popup.getByRole('button', { name: 'Allow for this visit', exact: true }).click()
  await expect(page.getByRole('button', { name: 'End URL session', exact: true })).toBeVisible({ timeout: 15000 })
  console.log('PASS: installed extension and approved this visit in extension-owned UI')
  await page.getByLabel('Page URL', { exact: true }).fill('https://ioe.iitm.ac.in/#explore')
  await page.getByRole('button', { name: 'Convert to Markdown', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Custom Preview' })).toBeVisible({ timeout: 190000 })
  await expect(page.locator('.markdown-content')).not.toBeEmpty()
  await expect(page.getByRole('region', { name: 'Custom Preview' })).not.toContainText(/Review unsupported <(?:br|a|i)>/)
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download .md', exact: true }).click()
  const download = await downloadEvent
  const markdown = await readFile(await download.path(), 'utf8')
  expect(markdown.length).toBeGreaterThan(100)
  expect(markdown).toMatch(/Madras|IIT|Eminence/i)
  await page.screenshot({ path: '.tmp/extension-iitm-import.png', fullPage: false })
  console.log('PASS: IIT Madras download → existing worker/parser → preview → Markdown', { filename: download.suggestedFilename(), characters: markdown.length })
  await page.getByRole('button', { name: 'Close import session', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard review', exact: true }).click()
  // Emulate Chrome suspending the extension worker. Approval must survive only
  // for this exact document, while a later reload still starts unapproved.
  const devtools = await context.browser().newBrowserCDPSession()
  const targets = await devtools.send('Target.getTargets')
  const worker = targets.targetInfos.find(target => target.type === 'service_worker' && target.url.startsWith('chrome-extension://'))
  if (!worker) throw new Error('Extension service worker was not found for restart verification.')
  await devtools.send('Target.closeTarget', { targetId: worker.targetId })
  await devtools.detach()
  await page.getByLabel('Page URL', { exact: true }).fill('https://example.com/')
  await page.getByRole('button', { name: 'Convert to Markdown', exact: true }).click()
  await expect(page.locator('.markdown-content h1')).toHaveText('Example Domain', { timeout: 45000 })
  expect(context.pages().filter(tab => tab.url().includes('/approve.html'))).toHaveLength(0)
  console.log('PASS: a second domain needs no new approval, even after extension-worker restart')
  page.on('dialog', dialog => dialog.accept())
  await page.reload()
  await expect(enable).toBeEnabled()
  await expect(page.getByRole('button', { name: 'End URL session', exact: true })).toHaveCount(0)
  const secondPopup = context.waitForEvent('page')
  await enable.click()
  const approval = await secondPopup
  await approval.getByRole('button', { name: 'Not now', exact: true }).click()
  await expect(enable).toBeEnabled()
  await expect(page.getByRole('button', { name: 'End URL session', exact: true })).toHaveCount(0)
  expect(apiRequests).toEqual([])
  expect(errors).toEqual([])
  console.log('PASS: reload reset, denial, no /api/import calls, no page errors', app)
} finally {
  await context?.close()
  if (server) await new Promise(resolve => server.close(resolve))
}
