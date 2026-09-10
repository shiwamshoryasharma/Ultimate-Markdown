import { access, cp, lstat, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const project = await realpath(fileURLToPath(new URL('../', import.meta.url)))
const source = path.resolve(project, 'dist')
const target = path.resolve(project, 'web')
await access(path.join(source, 'index.html'))
if (await realpath(source) !== source || path.dirname(target) !== project || path.basename(target) !== 'web') {
  throw new Error('Build copy paths must stay inside this project.')
}
const existing = await lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error; return null })
if (existing && (!existing.isDirectory() || existing.isSymbolicLink() || await realpath(target) !== target)) {
  throw new Error('Refusing to replace a linked or non-directory web path.')
}
// web is generated output. Remove old hashed assets only after validating paths.
await rm(target, { recursive: true, force: true })
await cp(source, target, { recursive: true })
await cp(path.join(project, 'LICENSE'), path.join(target, 'LICENSE'))
await writeFile(path.join(target, '.nojekyll'), '')
console.log('Copied dist/ to web/ (ready for static hosting).')
