import test from 'node:test'
import assert from 'node:assert/strict'
import { validateDownloadUrl, isAppUrl, streamDownload } from '../extension/core.mjs'

test('extension bridge only accepts the two production apps and explicit local dev hosts', () => {
  for (const url of ['https://ultimate-markdown.web.app/#/import', 'https://ultimate-markdown.firebaseapp.com/', 'http://localhost:5173/import']) assert.equal(isAppUrl(url), true)
  for (const url of ['https://evil.example/', 'https://ultimate-markdown.web.app.evil.example/', 'http://ultimate-markdown.web.app/', 'http://localhost:9000/', 'about:blank']) assert.equal(isAppUrl(url), false)
})

test('downloads reject local addresses, credentials, nonstandard ports and non-web schemes', () => {
  for (const url of ['file:///etc/passwd', 'http://localhost/', 'http://127.1/', 'http://[::1]/', 'https://a.internal/', 'https://user:secret@example.com/', 'https://example.com:1234/']) assert.throws(() => validateDownloadUrl(url))
  assert.equal(validateDownloadUrl('https://example.com/a#heading').href, 'https://example.com/a')
})

test('retrieval streams bounded chunks and preserves final URL without credentials', async () => {
  const messages = []
  const text = '<main>' + 'x'.repeat(800000) + '</main>'
  await streamDownload('https://example.com/', 'page', new AbortController().signal, async message => { messages.push(message) }, async (url, options) => {
    assert.equal(options.credentials, 'omit')
    assert.equal(options.referrerPolicy, 'no-referrer')
    const response = new Response(text, { headers: { 'Content-Type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: 'https://example.com/final' })
    return response
  })
  assert.equal(messages[0].url, 'https://example.com/final')
  const chunks = messages.filter(m => m.type === 'chunk')
  assert.ok(chunks.length > 1)
  assert.ok(chunks.every(m => m.data.length <= Math.ceil(256 * 1024 / 3) * 4))
  assert.equal(Buffer.concat(chunks.map(m => Buffer.from(m.data, 'base64'))).toString(), text)
  assert.equal(messages.at(-1).type, 'end')
})

test('retrieval rejects oversized bodies, wrong MIME and cancellation before fetching', async () => {
  const send = async () => {}
  await assert.rejects(streamDownload('https://example.com/', 'page', new AbortController().signal, send, async () => new Response('', { headers: { 'Content-Type': 'text/html', 'Content-Length': String(200 * 1024 * 1024 + 1) } })), /200 MiB/)
  await assert.rejects(streamDownload('https://example.com/', 'image', new AbortController().signal, send, async () => new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'image/png' } })), /2 MiB/)
  await assert.rejects(streamDownload('https://example.com/', 'page', new AbortController().signal, send, async () => new Response('pdf', { headers: { 'Content-Type': 'application/pdf' } })), /HTML/)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(streamDownload('https://example.com/', 'page', controller.signal, send, async () => assert.fail('Cancelled request must not fetch')))
})

test('exactly 200 MiB streams through the extension without a giant message', async () => {
  const maximum = 200 * 1024 * 1024
  let remaining = maximum, received = 0, ended = false
  await streamDownload('https://example.com/', 'page', new AbortController().signal, async message => {
    if (message.type === 'chunk') received += Buffer.from(message.data, 'base64').length
    if (message.type === 'end') ended = true
  }, async () => new Response(new ReadableStream({ pull(controller) {
    if (!remaining) { controller.close(); return }
    const size = Math.min(1024 * 1024, remaining)
    remaining -= size
    controller.enqueue(new Uint8Array(size))
  } }), { headers: { 'Content-Type': 'text/html', 'Content-Length': String(maximum) } }))
  assert.equal(received, maximum)
  assert.equal(ended, true)
})
