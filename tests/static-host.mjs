import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

// A plain static server: no Vite and no SPA fallback to hide broken URLs.
const root = fileURLToPath(new URL('../web/', import.meta.url))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' }
const server = createServer(async (request, response) => {
  try {
    let name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    if (name.startsWith('/Ultimate-Markdown/')) name = name.slice('/Ultimate-Markdown'.length)
    const target = path.resolve(root, '.' + name, name.endsWith('/') ? 'index.html' : '')
    if (!target.startsWith(path.resolve(root) + path.sep) || !(await stat(target)).isFile()) throw new Error('Not a file')
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' })
    response.end(await readFile(target))
  } catch { response.writeHead(404); response.end('Not found') }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const origin = `http://127.0.0.1:${server.address().port}`
  for (const base of ['/', '/Ultimate-Markdown/']) {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
    await page.goto(origin + base)
    await expect(page.getByRole('heading', {name:'From Markdown to ready to share.'})).toBeVisible()
    expect(await page.locator('header img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
    await page.getByRole('button', {name:'Open in editor', exact:true}).click()
    await expect(page).toHaveURL(origin + base + '#/workspace')
    await page.locator('.cm-content').click()
    await page.keyboard.press('Control+f')
    await expect(page.getByRole('textbox', {name:'Find', exact:true})).toBeFocused()
    await page.keyboard.press('Escape')
    await page.reload()
    await expect(page.getByRole('link', {name:'Workspace', exact:true})).toHaveAttribute('aria-current', 'page')
    await page.getByRole('link', {name:'Home', exact:true}).click()
    await page.getByRole('button', {name:'Style & export', exact:true}).click()
    await page.getByRole('button', {name:'PDF', exact:true}).click()
    await expect(page.locator('[role=status]').filter({hasText:/^\d+ pages?$/})).toBeVisible({timeout:30000})
    await expect(page.frameLocator('iframe[title="Paginated export preview"]').locator('.pagedjs_page').first()).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', {name:'Convert document'})).toBeVisible()
    expect(errors).toEqual([])
    await page.close()
    console.log(`PASS: ${base} — Home, assets, hash navigation/refresh, Find and bundled paginator.`)
  }
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
