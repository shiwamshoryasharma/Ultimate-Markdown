import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'

/** Explicit allowlist: never include profiles, credentials or development files. */
export async function packageExtension() {
  const zip = new JSZip()
  const files = ['manifest.json', 'background.mjs', 'core.mjs', 'bridge.js', 'approve.html', 'approve.js', 'help.html', 'extension.css', 'README.md']
  for (const file of files) zip.file(file, await readFile(new URL(`../extension/${file}`, import.meta.url)), { date: new Date('2026-09-23T00:00:00Z') })
  zip.file('LICENSE', await readFile(new URL('../LICENSE', import.meta.url)), { date: new Date('2026-09-23T00:00:00Z') })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
