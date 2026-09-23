import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { Document, Packer, Paragraph, HeadingLevel } from 'docx'

const article = '<html><head><title>Extension guide</title></head><body><main><h1>Browser import guide</h1><p>Retrieved HTML becomes <strong>local Markdown</strong>.</p></main></body></html>'

/** Only the extension boundary is simulated; conversion, preview and export stay real. */
async function installCompanion(page: Page, mode: 'success' | 'failure' | 'pending' = 'success') {
  await page.addInitScript(({ html, mode }) => {
    const channel = 'ultimate-markdown-extension'
    const state = { approved: false, authorizations: 0, downloads: [] as string[], cancelled: [] as string[] }
    Object.assign(window, { companionTestState: state })
    const streams = new Map<string, boolean>()
    const reply = (id: string, payload: Record<string, unknown>) => window.postMessage({ channel, direction: 'response', id, ...payload }, location.origin)
    window.addEventListener('message', event => {
      const request = event.data
      if (event.source !== window || request?.channel !== channel || request.direction !== 'request') return
      if (request.action === 'status') reply(request.id, { type: 'result', installed: true, approved: state.approved })
      if (request.action === 'authorize') {
        state.approved = true
        state.authorizations++
        reply(request.id, { type: 'result', installed: true, approved: true })
      }
      if (request.action === 'revoke') {
        state.approved = false
        streams.clear()
        reply(request.id, { type: 'result', installed: true, approved: false })
      }
      if (request.action === 'download') {
        state.downloads.push(request.url)
        if (!state.approved) { reply(request.id, { type: 'error', error: 'Enable URL imports for this visit first.' }); return }
        if (mode === 'failure') { reply(request.id, { type: 'error', error: 'The source website returned HTTP 403.' }); return }
        if (mode === 'pending') return
        streams.set(request.id, false)
        reply(request.id, { type: 'start', url: request.url, mime: 'text/html; charset=utf-8' })
        reply(request.id, { type: 'chunk', data: btoa(html) })
      }
      if (request.action === 'ack' && streams.has(request.requestId)) {
        streams.delete(request.requestId)
        reply(request.requestId, { type: 'end' })
      }
      if (request.action === 'cancel') {
        state.cancelled.push(request.requestId)
        streams.delete(request.requestId)
      }
    })
  }, { html: article, mode })
}

async function companionState(page: Page) {
  return page.evaluate(() => (window as unknown as { companionTestState: { approved: boolean; authorizations: number; downloads: string[]; cancelled: string[] } }).companionTestState)
}

async function preventBackend(page: Page) {
  const requests: string[] = []
  await page.route('**/api/import', async route => {
    requests.push(route.request().url())
    await route.fulfill({ status: 404, body: 'Static hosting has no import server.' })
  })
  return requests
}

async function closeReview(page: Page) {
  await page.getByRole('button', { name: 'Close import session', exact: true }).click()
  await page.getByRole('dialog', { name: 'Close this import review?' }).getByRole('button', { name: 'Discard review', exact: true }).click()
}

test('URL import downloads through the companion, converts locally and reuses approval within one visit', async ({ page }) => {
  const backendRequests = await preventBackend(page)
  await installCompanion(page)
  await page.goto('/import')
  await expect(page.getByRole('button', { name: 'Enable URL imports', exact: true })).toBeVisible()
  expect((await companionState(page)).downloads).toEqual([])
  await page.getByRole('button', { name: 'Enable URL imports', exact: true }).click()
  await expect(page.getByRole('button', { name: 'End URL session', exact: true })).toBeVisible()
  await page.getByLabel('Page URL', { exact: true }).fill('https://article.example.com/first')
  await page.getByRole('button', { name: 'Convert to Markdown', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Custom Preview' })).toContainText('Browser import guide')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download .md', exact: true }).click()
  expect(readFileSync((await (await download).path())!, 'utf8')).toContain('**local Markdown**')
  await closeReview(page)
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await page.getByRole('link', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('button', { name: 'End URL session', exact: true })).toBeVisible()
  await page.getByLabel('Page URL', { exact: true }).fill('https://another.example.org/second')
  await page.getByRole('button', { name: 'Convert to Markdown', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Custom Preview' })).toContainText('Browser import guide')
  expect(await companionState(page)).toMatchObject({ authorizations: 1, downloads: ['https://article.example.com/first', 'https://another.example.org/second'] })
  expect(backendRequests).toEqual([])
})

test('reload and explicit session end each require new approval before URL import', async ({ page }) => {
  const backendRequests = await preventBackend(page)
  await installCompanion(page)
  await page.goto('/import')
  await page.getByRole('button', { name: 'Enable URL imports', exact: true }).click()
  await expect(page.getByRole('button', { name: 'End URL session', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Enable URL imports', exact: true })).toBeVisible()
  expect(await companionState(page)).toMatchObject({ approved: false, authorizations: 0, downloads: [] })
  await page.getByRole('button', { name: 'Enable URL imports', exact: true }).click()
  await page.getByRole('button', { name: 'End URL session', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Enable URL imports', exact: true })).toBeVisible()
  expect((await companionState(page)).approved).toBe(false)
  expect(backendRequests).toEqual([])
})

test('pasting a URL requests visit approval once without starting a download', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await installCompanion(page)
  await page.goto('/import')
  const input = page.getByLabel('Page URL', { exact: true })
  await page.evaluate(() => navigator.clipboard.writeText('https://example.com/first'))
  await input.focus(); await page.keyboard.press('Control+v')
  await expect(page.getByRole('button', { name: 'End URL session', exact: true })).toBeVisible()
  expect(await companionState(page)).toMatchObject({ approved: true, authorizations: 1, downloads: [] })
  await input.fill('')
  await page.evaluate(() => navigator.clipboard.writeText('https://another.example.com/second'))
  await input.focus(); await page.keyboard.press('Control+v')
  await expect(input).toHaveValue('https://another.example.com/second')
  expect((await companionState(page)).authorizations).toBe(1)
})

test('missing companion provides installation setup without contacting a backend', async ({ page }) => {
  const backendRequests = await preventBackend(page)
  await page.goto('/import')
  await expect(page.getByRole('link', { name: /Download extension/i })).toBeVisible()
  await page.getByLabel('Page URL', { exact: true }).fill('https://article.example.com/')
  const convert = page.getByRole('button', { name: 'Convert to Markdown', exact: true })
  if (await convert.isEnabled()) await convert.click()
  await expect(page.getByText(/install.*extension|extension.*install/i).first()).toBeVisible()
  expect(backendRequests).toEqual([])
})

test('source errors retain actionable local HTML fallback', async ({ page }) => {
  const backendRequests = await preventBackend(page)
  await installCompanion(page, 'failure')
  await page.goto('/import')
  await page.getByRole('button', { name: 'Enable URL imports', exact: true }).click()
  await page.getByLabel('Page URL', { exact: true }).fill('https://blocked.example.com/docs')
  await page.getByRole('button', { name: 'Convert to Markdown', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('HTTP 403')
  await expect(page.getByRole('region', { name: 'Custom Preview' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Import saved or pasted HTML', exact: true }).click()
  await page.getByLabel('Paste HTML', { exact: true }).fill(article)
  await page.getByRole('button', { name: 'Parse & review', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Custom Preview' })).toContainText('Browser import guide')
  expect(backendRequests).toEqual([])
})

test('stopping a companion download cancels it without creating a review', async ({ page }) => {
  const backendRequests = await preventBackend(page)
  await installCompanion(page, 'pending')
  await page.goto('/import')
  await page.getByRole('button', { name: 'Enable URL imports', exact: true }).click()
  await page.getByLabel('Page URL', { exact: true }).fill('https://slow.example.com/')
  await page.getByRole('button', { name: 'Convert to Markdown', exact: true }).click()
  await expect.poll(async () => (await companionState(page)).downloads.length).toBe(1)
  await page.getByRole('button', { name: 'Stop import', exact: true }).click()
  await expect.poll(async () => (await companionState(page)).cancelled.length).toBe(1)
  await expect(page.getByRole('button', { name: 'Convert to Markdown', exact: true })).toBeEnabled()
  await expect(page.getByRole('region', { name: 'Custom Preview' })).toHaveCount(0)
  expect(backendRequests).toEqual([])
})

test('HTML and Word imports continue to work locally without an extension or approval', async ({ page }) => {
  const backendRequests = await preventBackend(page)
  await page.goto('/import')
  await page.getByRole('button', { name: 'HTML', exact: true }).click()
  await page.getByLabel('Paste HTML', { exact: true }).fill(article)
  await page.getByRole('button', { name: 'Parse & review', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Custom Preview' })).toContainText('Browser import guide')
  await closeReview(page)
  const buffer = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph({ text: 'Local Word guide', heading: HeadingLevel.HEADING_1 }), new Paragraph('No URL permission needed.')] }] }))
  await page.getByRole('button', { name: 'Word Document', exact: true }).click()
  await page.getByLabel('Choose DOCX', { exact: false }).setInputFiles({ name: 'local.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer })
  await page.getByRole('button', { name: 'Parse & review', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Custom Preview' })).toContainText('Local Word guide')
  expect(backendRequests).toEqual([])
})
