import type { DirectoryNode, FileNode, WorkspaceNode, WorkspaceSourceKind } from '@/types/filesystem'
import { scanDirectoryHandle } from './scanDirectoryHandle'
import { buildAssetMap, buildTreeFromFileList } from './scanFileList'
import { getExtension, isDocumentFile, sortNodes } from './paths'
import { isAbortError } from './permissions'

export class UnsupportedFeatureError extends Error {}

export interface PickedWorkspace {
  folderAccess?: boolean
  tree: WorkspaceNode[]
  sourceKind: WorkspaceSourceKind
  rootName: string
  rootHandle?: FileSystemDirectoryHandle
  assetFiles?: Map<string, File>
}

function getFsWindow(): FileSystemAccessWindow | null {
  const w = window as Partial<FileSystemAccessWindow>
  if (typeof w.showDirectoryPicker === 'function' && typeof w.showOpenFilePicker === 'function') {
    return window as unknown as FileSystemAccessWindow
  }
  return null
}

function fileToNode(file: File, handle?: FileSystemFileHandle): FileNode {
  return {
    kind: 'file',
    id: file.name,
    name: file.name,
    path: file.name,
    extension: getExtension(file.name),
    origin: handle ? 'handle' : 'file',
    handle,
    file,
    size: file.size,
    lastModified: file.lastModified,
  }
}

/** Method 1 — Open File. Prefers the File System Access API (enables Save later); falls back to a plain <input type=file>. */
export async function pickSingleFile(): Promise<FileNode | null> {
  const fsWindow = getFsWindow()
  if (fsWindow) {
    try {
      const [handle] = await fsWindow.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: false,
        types: [
          {
            description: 'Markdown',
            accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] },
          },
        ],
      })
      const file = await handle.getFile()
      return fileToNode(file, handle)
    } catch (error) {
      if (isAbortError(error)) return null
      throw error
    }
  }
  return pickSingleFileViaInput()
}

function pickSingleFileViaInput(): Promise<FileNode | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt'
    let settled = false
    const finish = (value: FileNode | null) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(value)
    }
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      finish(file ? fileToNode(file) : null)
    })
    input.addEventListener('cancel', () => finish(null))
    document.body.appendChild(input)
    input.click()
  })
}

/** Method 3 — Folder Selection. Requests read-only access first; write access is requested later, only when Save is used. */
export async function pickDirectory(): Promise<PickedWorkspace | null> {
  const fsWindow = getFsWindow()
  if (fsWindow) {
    let dirHandle: FileSystemDirectoryHandle
    try {
      dirHandle = await fsWindow.showDirectoryPicker({ mode: 'read' })
    } catch (error) {
      if (isAbortError(error)) return null
      throw error
    }
    const scanned = await scanDirectoryHandle(dirHandle)
    return {
      tree: scanned ? sortNodes(scanned.children) : [],
      sourceKind: 'directory-handle',
      rootName: dirHandle.name,
      rootHandle: dirHandle,
    }
  }
  return pickDirectoryViaInput()
}

function pickDirectoryViaInput(): Promise<PickedWorkspace | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    ;(input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true
    let settled = false
    const finish = (value: PickedWorkspace | null) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(value)
    }
    input.addEventListener('change', () => {
      const files = input.files ? Array.from(input.files) : []
      if (files.length === 0) {
        finish(null)
        return
      }
      const first = files[0] as File & { webkitRelativePath?: string }
      const rootName = first.webkitRelativePath?.split('/')[0] || 'Folder'
      finish({
        tree: buildTreeFromFileList(files),
        sourceKind: 'webkitdirectory',
        rootName,
        assetFiles: buildAssetMap(files),
      })
    })
    input.addEventListener('cancel', () => finish(null))
    document.body.appendChild(input)
    input.click()
  })
}

/** Method 2 — Drag and Drop. Uses getAsFileSystemHandle where the browser exposes it (Chromium), else falls back to a flat file list. */
export async function readDroppedItems(dataTransfer: DataTransfer): Promise<PickedWorkspace | null> {
  const items = Array.from(dataTransfer.items || []).filter((item) => item.kind === 'file')
  const first = items[0] as DataTransferItemWithHandle | undefined
  const supportsHandles = !!first && typeof first.getAsFileSystemHandle === 'function'

  if (supportsHandles) {
    // getAsFileSystemHandle() existing doesn't guarantee it resolves — some sources/browsers expose the
    // method but return null for every item. When that happens, fall through to the plain-files path
    // below instead of reporting "nothing was dropped".
    const handles = await Promise.all(
      items.map((item) => (item as DataTransferItemWithHandle).getAsFileSystemHandle().catch(() => null)),
    )
    const nodes: WorkspaceNode[] = []
    for (const handle of handles) {
      if (!handle) continue
      if (handle.kind === 'file') {
        if (!isDocumentFile(handle.name)) continue
        const fileHandle = handle as FileSystemFileHandle
        const file = await fileHandle.getFile()
        nodes.push(fileToNode(file, fileHandle))
      } else {
        const scanned = await scanDirectoryHandle(handle as FileSystemDirectoryHandle)
        if (scanned) nodes.push(scanned)
      }
    }

    if (nodes.length > 0) {
      if (nodes.length === 1 && nodes[0].kind === 'directory') {
        const dir = nodes[0] as DirectoryNode
        return { tree: dir.children, sourceKind: 'directory-handle', rootName: dir.name, rootHandle: dir.handle }
      }
      return { tree: sortNodes(nodes), sourceKind: 'files', rootName: 'Dropped Files', assetFiles: buildAssetMap(Array.from(dataTransfer.files)) }
    }
  }

  const allFiles = Array.from(dataTransfer.files || [])
  const documentFiles = allFiles.filter((file) => isDocumentFile(file.name))
  if (documentFiles.length === 0) return null
  return {
    tree: buildTreeFromFileList(documentFiles),
    folderAccess: allFiles.some((file) => !!file.webkitRelativePath),
    sourceKind: 'files',
    rootName: 'Dropped Files',
    assetFiles: buildAssetMap(allFiles),
  }
}
