import type { FileNode, WorkspaceNode } from '@/types/filesystem'
import { getExtension, isDocumentFile, isHiddenName, sortNodes } from './paths'

interface Bucket {
  path: string
  name: string
  children: Map<string, Bucket>
  files: FileNode[]
}

/** `webkitRelativePath` always starts with the picked folder's own name — strip it so paths are workspace-relative, matching the directory-handle scan. */
function relativeToRoot(file: File): string[] {
  const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
  const segments = relPath.split('/').filter(Boolean)
  return segments.length > 1 ? segments.slice(1) : segments
}

/**
 * Rebuilds a folder tree from a flat FileList that carries `webkitRelativePath`
 * (the `<input webkitdirectory>` fallback, used when the File System Access
 * API isn't available). Only document files become tree nodes — see
 * scanDirectoryHandle for why non-document files are excluded here too.
 */
export function buildTreeFromFileList(files: File[]): WorkspaceNode[] {
  const root: Bucket = { path: '', name: '', children: new Map(), files: [] }

  for (const file of files) {
    const segments = relativeToRoot(file)
    if (segments.length === 0 || segments.some(isHiddenName)) continue
    const fileName = segments[segments.length - 1]
    if (!isDocumentFile(fileName)) continue

    let cursor = root
    let currentPath = ''
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      let next = cursor.children.get(segment)
      if (!next) {
        next = { path: currentPath, name: segment, children: new Map(), files: [] }
        cursor.children.set(segment, next)
      }
      cursor = next
    }

    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName
    cursor.files.push({
      kind: 'file',
      id: filePath,
      name: fileName,
      path: filePath,
      extension: getExtension(fileName),
      origin: 'file',
      file,
      size: file.size,
      lastModified: file.lastModified,
    })
  }

  function toNodes(bucket: Bucket): WorkspaceNode[] {
    const dirNodes: WorkspaceNode[] = [...bucket.children.values()].map((child) => ({
      kind: 'directory' as const,
      id: child.path,
      name: child.name,
      path: child.path,
      children: toNodes(child),
    }))
    return sortNodes([...dirNodes, ...bucket.files])
  }

  return toNodes(root)
}

/** Every file (any type) in a picked folder, keyed by workspace-relative path — used for local image/media resolution when there's no directory handle. */
export function buildAssetMap(files: File[]): Map<string, File> {
  const map = new Map<string, File>()
  for (const file of files) {
    const segments = relativeToRoot(file)
    if (segments.length === 0 || segments.some(isHiddenName)) continue
    map.set(segments.join('/'), file)
  }
  return map
}
