import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

async function importHtml(page: Page, html: string) {
  await page.goto('/import')
  await page.getByRole('button', { name: 'HTML', exact: true }).click()
  await page.getByLabel('Paste HTML', { exact: true }).fill(html)
  await page.getByRole('button', { name: 'Parse & review', exact: true }).click()
  const review = page.getByRole('region', { name: 'Custom Preview' })
  await expect(review).toBeVisible()
  return { review, content: review.locator('.markdown-content') }
}

async function downloadMarkdown(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download .md', exact: true }).click()
  return readFileSync((await (await download).path())!, 'utf8')
}

test('inline root text keeps one paragraph, hard breaks, links and emphasis in preview and Markdown', async ({ page }) => {
  const { review, content } = await importHtml(page, '<main><h1>Inline article</h1>Read <a href="https://example.com/guide">the guide</a> before <i>starting</i>.<br>Keep <strong>this phrase</strong> together.<br>Final line.</main>')
  await expect(content.locator('p')).toHaveCount(1)
  await expect(content.locator('p')).toHaveText('Read the guide before starting. Keep this phrase together. Final line.')
  await expect(content.locator('p br')).toHaveCount(2)
  await expect(content.locator('p a')).toHaveAttribute('href', 'https://example.com/guide')
  await expect(content.locator('p em')).toHaveText('starting')
  await expect(content.locator('p strong')).toHaveText('this phrase')
  await expect(review).not.toContainText('Review unsupported')
  const markdown = await downloadMarkdown(page)
  expect(markdown).toContain('Read [the guide](https://example.com/guide) before _starting_.')
  expect(markdown).toContain('Keep **this phrase** together.')
  expect(markdown).toMatch(/starting_\. {2}\nKeep/)
  expect(markdown).toMatch(/together\. {2}\nFinal line\./)
  expect(markdown.trim().split(/\n\s*\n/)).toHaveLength(2)
})

test('nested layout containers retain paragraph boundaries without splitting inline runs or duplicating text', async ({ page }) => {
  const { review, content } = await importHtml(page, '<main><h1>Nested layout</h1><div>Outer <span>introduction</span> with <strong>focus</strong>.<div>Inner <i>detail</i><br>continued.</div>Outer tail <a href="https://example.com/end">link</a>.</div><section><div><p>Explicit <strong>paragraph</strong>.</p></div></section></main>')
  await expect(content.locator('p')).toHaveCount(4)
  await expect(content.locator('p').nth(0)).toHaveText('Outer introduction with focus.')
  await expect(content.locator('p').nth(1)).toHaveText('Inner detail continued.')
  await expect(content.locator('p').nth(1).locator('br')).toHaveCount(1)
  await expect(content.locator('p').nth(2)).toHaveText('Outer tail link.')
  await expect(content.locator('p').nth(3)).toHaveText('Explicit paragraph.')
  await expect(review).not.toContainText('Review unsupported')
  const markdown = await downloadMarkdown(page)
  expect(markdown).toContain('Outer introduction with **focus**.')
  expect(markdown).toContain('Outer tail [link](https://example.com/end).')
  expect(markdown.match(/Inner/g)).toHaveLength(1)
  expect(markdown.match(/Explicit/g)).toHaveLength(1)
  expect(markdown.trim().split(/\n\s*\n/)).toHaveLength(5)
})

test('safe disclosures, definitions and inline semantic tags survive preview and Markdown export', async ({ page }) => {
  const { review, content } = await importHtml(page, '<main><h1>Semantic reference</h1><details open><summary>Advanced options</summary><p>Keep this <strong>explanation</strong>.</p></details><dl><dt>Latency</dt><dd>Elapsed response time.</dd><dt>Throughput</dt><dd>Completed work per second.</dd></dl><p>H<sub>2</sub>O and x<sup>2</sup>; press <kbd>Ctrl</kbd>; <mark>remember this</mark>.</p></main>')
  await expect(content.locator('details')).toHaveCount(1)
  await expect(content.locator('details > summary')).toHaveText('Advanced options')
  await expect(content.locator('details strong')).toHaveText('explanation')
  await expect(content.locator('dl dt')).toHaveText(['Latency', 'Throughput'])
  await expect(content.locator('dl dd')).toHaveText(['Elapsed response time.', 'Completed work per second.'])
  await expect(content.locator('sub')).toHaveText('2')
  await expect(content.locator('sup')).toHaveText('2')
  await expect(content.locator('kbd')).toHaveText('Ctrl')
  await expect(content.locator('mark')).toHaveText('remember this')
  await expect(review).not.toContainText('Review unsupported')
  const markdown = await downloadMarkdown(page)
  for (const tag of ['details', 'summary', 'dl', 'dt', 'dd', 'sub', 'sup', 'kbd', 'mark']) expect(markdown).toMatch(new RegExp(`<${tag}(?:>|\\s)`))
  expect(markdown).toContain('Elapsed response time.')
  expect(markdown).toContain('Completed work per second.')
})

test('preserving semantic HTML never preserves executable source content', async ({ page }) => {
  const { content } = await importHtml(page, '<main><h1>Safe semantic content</h1><script>window.importExecuted=true</script><details open ontoggle="window.importExecuted=true"><summary onclick="window.importExecuted=true">Safe summary</summary><p>Read <a href="javascript:window.importExecuted=true">this link</a>.</p></details><dl><dt onmouseover="window.importExecuted=true">Term</dt><dd><mark style="background:url(javascript:alert(1))" onclick="window.importExecuted=true">Definition</mark></dd></dl><iframe srcdoc="<script>parent.importExecuted=true</script>"></iframe><object data="javascript:alert(1)"></object></main>')
  await expect(content).toContainText('Safe summary')
  await expect(content).toContainText('Definition')
  await expect(content.locator('script, iframe, object, [onclick], [ontoggle], [onmouseover], [style]')).toHaveCount(0)
  await expect(content.locator('a[href^="javascript:"]')).toHaveCount(0)
  expect(await page.evaluate(() => 'importExecuted' in window)).toBe(false)
  const markdown = await downloadMarkdown(page)
  expect(markdown).not.toMatch(/<script|<iframe|<object|\bonclick\s*=|\bontoggle\s*=|\bonmouseover\s*=|javascript:|importExecuted/i)
  expect(markdown).toContain('Safe summary')
  expect(markdown).toContain('Definition')
})

test('table captions, merged cells and nested semantic markup retain their content', async ({ page }) => {
  const { content } = await importHtml(page, '<main><h1>Data reference</h1><table><caption>Measurement units</caption><tr><th>Item</th><th>Unit</th></tr><tr><td>Area</td><td>m<sup>2</sup></td></tr></table><table><caption>Merged reference</caption><tr><th colspan="2">Combined</th></tr><tr><td>A</td><td>B</td></tr></table><p><u>Keep <strong>bold</strong> inside underline</u>.</p></main>')
  await expect(content).toContainText('Measurement units')
  await expect(content.locator('table').first().locator('sup')).toHaveText('2')
  await expect(content.locator('th[colspan="2"]')).toHaveText('Combined')
  await expect(content.locator('table caption')).toHaveText('Merged reference')
  await expect(content.locator('u strong')).toHaveText('bold')
  const markdown = await downloadMarkdown(page)
  expect(markdown).toContain('Measurement units')
  expect(markdown).toContain('<sup>2</sup>')
  expect(markdown).toContain('colspan="2"')
  expect(markdown).toContain('Merged reference')
  expect(markdown).toContain('<u>Keep <strong>bold</strong> inside underline</u>')
})
