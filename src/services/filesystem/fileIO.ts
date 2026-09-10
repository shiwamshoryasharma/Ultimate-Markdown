import type { FileNode } from '@/types/filesystem'
import { getExtension } from './paths'
import { ensureWritePermission, isAbortError } from './permissions'
import { UnsupportedFeatureError } from './pickers'

/** Re-reads the current text content of a file node from its live source (handle preferred so on-disk edits made outside the app are picked up). */
export async function readFileText(node: FileNode): Promise<string> {
  if (node.handle) {
    const file = await node.handle.getFile()
    return file.text()
  }
  if (node.file) return node.file.text()
  throw new Error(`"${node.name}" has no readable source.`)
}

/** Writes in place. Only possible for nodes opened via the File System Access API — callers must fall back to a download otherwise. */
export async function writeFileText(node: FileNode, content: string): Promise<void> {
  if (!node.handle) {
    throw new UnsupportedFeatureError(
      `"${node.name}" was opened without filesystem write access. Use "Download" to save a copy instead.`,
    )
  }
  const granted = await ensureWritePermission(node.handle)
  if (!granted) {
    throw new Error('Write permission was not granted, so the file could not be saved.')
  }
  const writable = await node.handle.createWritable()
  await writable.write(content)
  await writable.close()
}

export function canSaveInPlace(node: FileNode | null | undefined): boolean {
  return !!node?.handle
}

function getFsWindow(): FileSystemAccessWindow | null {
  const w = window as Partial<FileSystemAccessWindow>
  if (typeof w.showSaveFilePicker === 'function') return window as unknown as FileSystemAccessWindow
  return null
}

/** Save As via the native picker. Returns the new FileNode on success, null if the user cancelled, or throws if the API isn't available (caller should fall back to a download). */
export async function saveFileAs(content: string, suggestedName: string): Promise<FileNode | null> {
  const fsWindow = getFsWindow()
  if (!fsWindow) {
    throw new UnsupportedFeatureError('Save As is not available in this browser — use "Download" instead.')
  }
  let handle: FileSystemFileHandle
  try {
    handle = await fsWindow.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
    })
  } catch (error) {
    if (isAbortError(error)) return null
    throw error
  }
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
  const file = await handle.getFile()
  return {
    kind: 'file',
    id: file.name,
    name: file.name,
    path: file.name,
    extension: getExtension(file.name),
    origin: 'handle',
    handle,
    file,
    size: file.size,
    lastModified: file.lastModified,
  }
}
