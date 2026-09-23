import type { Page } from '@playwright/test'

type DownloadRequest = { url: string; kind: 'page' | 'image' }
type DownloadFixture = { url?: string; html?: string; data?: string; error?: string }

/** Simulate only Chrome's extension bridge; keep the app's import pipeline real. */
export async function installFixtureCompanion(page: Page, download: (request: DownloadRequest) => DownloadFixture | Promise<DownloadFixture>) {
  await page.exposeBinding('companionFixtureDownload', (_source, request: DownloadRequest) => download(request))
  await page.addInitScript(() => {
    const channel = 'ultimate-markdown-extension'
    let approved = false
    const waiting = new Set<string>()
    const reply = (id: string, message: Record<string, unknown>) => window.postMessage({ channel, direction: 'response', id, ...message }, location.origin)
    window.addEventListener('message', async event => {
      const request = event.data
      if (event.source !== window || request?.channel !== channel || request.direction !== 'request') return
      if (['status', 'authorize', 'revoke'].includes(request.action)) {
        if (request.action !== 'status') approved = request.action === 'authorize'
        reply(request.id, { type: 'result', installed: true, approved })
      }
      if (request.action === 'ack' && waiting.delete(request.requestId)) reply(request.requestId, { type: 'end' })
      if (request.action === 'cancel') waiting.delete(request.requestId)
      if (request.action !== 'download') return
      try {
        if (!approved) throw new Error('Enable URL imports first.')
        const result = await (window as unknown as { companionFixtureDownload: (request: DownloadRequest) => Promise<DownloadFixture> }).companionFixtureDownload({ url: request.url, kind: request.kind })
        if (result.error) throw new Error(result.error)
        let mime = 'text/html; charset=utf-8', data = ''
        if (result.data) {
          const match = /^data:([^;]+);base64,(.*)$/.exec(result.data)
          if (!match) throw new Error('Invalid test image fixture')
          mime = match[1]; data = match[2]
        } else data = btoa(String.fromCharCode(...new TextEncoder().encode(result.html || '')))
        waiting.add(request.id)
        reply(request.id, { type: 'start', url: result.url || request.url, mime })
        reply(request.id, { type: 'chunk', data })
      } catch (error) { reply(request.id, { type: 'error', error: error instanceof Error ? error.message : String(error) }) }
    })
  })
}
