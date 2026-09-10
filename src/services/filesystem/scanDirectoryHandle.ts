import type { DirectoryNode, WorkspaceNode } from '@/types/filesystem'
import { getExtension, isDocumentFile, isHiddenName, joinPath, sortNodes } from './paths'

const MAX_DEPTH = 24

/**
 * Recursively walks a FileSystemDirectoryHandle, keeping only directories that
 * contain (directly or transitively) at least one markdown/text document —
 * matches "recursively discover Markdown files", not "list every file type".
 * Non-document files (images, docx, pptx, etc.) are deliberately excluded from
 * the explorer tree; they're resolved on demand instead (see localAssets.ts).
 */
export async function scanDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  path = '',
  depth = 0,
): Promise<DirectoryNode | null> {
  if (depth > MAX_DEPTH) return null

  const children: WorkspaceNode[] = []

  for await (const [name, entryHandle] of handle.entries()) {
    if (isHiddenName(name)) continue
    const childPath = joinPath(path, name)

    if (entryHandle.kind === 'file') {
      if (!isDocumentFile(name)) continue
      const fileHandle = entryHandle as FileSystemFileHandle
      let size: number | undefined
      let lastModified: number | undefined
      try {
        const file = await fileHandle.getFile()
        size = file.size
        lastModified = file.lastModified
      } catch {
        // Unreadable file (permission revoked mid-scan, etc.) — still list it, size/mtime just unknown.
      }
      children.push({
        kind: 'file',
        id: childPath,
        name,
        path: childPath,
        extension: getExtension(name),
        origin: 'handle',
        handle: fileHandle,
        size,
        lastModified,
      })
    } else {
      const sub = await scanDirectoryHandle(entryHandle as FileSystemDirectoryHandle, childPath, depth + 1)
      if (sub) children.push(sub)
    }
  }

  if (children.length === 0) return null

  return {
    kind: 'directory',
    id: path || handle.name,
    name: path ? handle.name : handle.name,
    path,
    handle,
    children: sortNodes(children),
  }
}
