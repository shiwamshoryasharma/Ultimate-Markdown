import { test, expect, type Locator } from '@playwright/test'

async function scrollReader(content: Locator) {
  await content.evaluate(el => {
    let parent = el.parentElement
    while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement
    if (!parent) throw new Error('Missing document scroll container')
    parent.scrollTop = 1200
  })
}

test('Back to top scrolls imported preview, Markdown source and workspace reader', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/import')
  await expect(page).toHaveTitle('Ultimate Markdown')
  await page.getByRole('button', { name: /^HTML/ }).click()
  await page.getByLabel('Paste HTML').fill('<h1>Long document</h1>' + Array.from({ length: 60 }, (_, i) => `<p>Paragraph ${i} with enough text to read.</p>`).join(''))
  await page.getByRole('button', { name: 'Parse & review' }).click()
  const top = page.getByRole('button', { name: 'Back to top', exact: true })
  for (const mode of ['Preview', 'Markdown']) {
    await page.getByRole('button', { name: mode, exact: true }).click()
    const content = mode === 'Preview' ? page.locator('.markdown-content') : page.getByLabel('Markdown source')
    await scrollReader(content)
    await expect(top).toBeVisible()
    if (mode === 'Markdown') await page.screenshot({ path: '.tmp/back-to-top-markdown.png' })
    await top.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Long document', exact: true }).first()).toBeInViewport()
    await expect(top).toBeHidden()
  }
  await page.getByRole('button', { name: 'Open in editor', exact: true }).click()
  await expect(page.locator('.markdown-content h1')).toHaveText('Long document')
  await scrollReader(page.locator('.markdown-content'))
  await expect(top).toBeVisible()
  await top.click()
  await expect(page.locator('.markdown-content h1')).toBeInViewport()
  await expect(top).toBeHidden()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await scrollReader(page.locator('.markdown-content'))
  await expect(top).toBeInViewport()
  await page.screenshot({ path: '.tmp/back-to-top-mobile.png' })
  await top.click()
  await expect(page.locator('.markdown-content h1')).toBeInViewport()
})
