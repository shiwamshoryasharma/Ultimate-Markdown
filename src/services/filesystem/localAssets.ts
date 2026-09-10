import type { Workspace } from '@/types/filesystem'
import { resolveDocumentPath } from '@/services/markdown/documentLinks'

interface CacheEntry {
  url: string
  refCount: number
}

const urlCache = new Map<string, CacheEntry>()
const workspaceIds = new WeakMap<Workspace, number>()
let nextWorkspaceId = 0
let generation = 0
function keyFor(workspace: Workspace, path: string) {
  if (!workspaceIds.has(workspace)) workspaceIds.set(workspace, ++nextWorkspaceId)
  return `${workspaceIds.get(workspace)}::${path}`
}

function hasScheme(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')
}

/** Resolves a markdown-relative path (`./assets/foo.png`, `../shared/x.png`) against the path of the document that references it. */
function resolveRelativePath(documentPath: string, relativeSrc: string): string | null {
  return resolveDocumentPath(documentPath, relativeSrc)
}

async function getFileFromHandle(root: FileSystemDirectoryHandle, path: string): Promise<File | null> {
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return null
  let dir = root
  try {
    for (let i = 0; i < segments.length - 1; i++) {
      dir = await dir.getDirectoryHandle(segments[i])
    }
    const fileHandle = await dir.getFileHandle(segments[segments.length - 1])
    return await fileHandle.getFile()
  } catch {
    return null
  }
}

/**
 * Resolves a local relative image/media reference to a temporary, viewable
 * URL. Returns null for non-local sources (http(s):, data:, mailto:, etc. —
 * those are left untouched) or when the referenced file can't be found.
 * Every resolved URL is refcounted; pair each call with releaseLocalAsset
 * once the consumer (an <img>, a <video>) unmounts.
 */
export async function resolveLocalAsset(
  workspace: Workspace,
  documentPath: string,
  relativeSrc: string,
): Promise<string | null> {
  if (hasScheme(relativeSrc)) return null

  const resolvedPath = resolveRelativePath(documentPath, relativeSrc)
  if (!resolvedPath) return null
  const cacheKey = keyFor(workspace, resolvedPath)
  const started = generation
  const cached = urlCache.get(cacheKey)
  if (cached) {
    cached.refCount += 1
    return cached.url
  }

  let file: File | null = null
  if (workspace.assetFiles?.has(resolvedPath)) {
    file = workspace.assetFiles.get(resolvedPath) ?? null
  } else if (workspace.rootHandle) {
    file = await getFileFromHandle(workspace.rootHandle, resolvedPath)
  } else if (workspace.assetFiles) {
    file = workspace.assetFiles.get(resolvedPath) ?? null
  }
  if (!file) return null
  if (started !== generation) return null
  const concurrent = urlCache.get(cacheKey)
  if (concurrent) { concurrent.refCount++; return concurrent.url }

  const url = URL.createObjectURL(file)
  urlCache.set(cacheKey, { url, refCount: 1 })
  return url
}

export function releaseLocalAsset(workspace: Workspace, documentPath: string, relativeSrc: string): void {
  if (hasScheme(relativeSrc)) return
  const resolvedPath = resolveRelativePath(documentPath, relativeSrc)
  if (!resolvedPath) return
  const cacheKey = keyFor(workspace, resolvedPath)
  const entry = urlCache.get(cacheKey)
  if (!entry) return
  entry.refCount -= 1
  if (entry.refCount <= 0) {
    URL.revokeObjectURL(entry.url)
    urlCache.delete(cacheKey)
  }
}

/** Called on workspace close/switch so no object URLs outlive their workspace. */
export function releaseAllLocalAssets(): void {
  generation++
  for (const entry of urlCache.values()) URL.revokeObjectURL(entry.url)
  urlCache.clear()
}
