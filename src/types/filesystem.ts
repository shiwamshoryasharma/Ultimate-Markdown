/** Extensions the file explorer discovers and lists as documents. */
export const DOCUMENT_EXTENSIONS = ['md', 'markdown', 'txt'] as const
export type DocumentExtension = (typeof DOCUMENT_EXTENSIONS)[number]

export type FileOrigin = 'handle' | 'file'

export interface FileNode {
  embeddedAssets?: Record<string,string>
  /** Open File grants this file only. Attaching assets does not enable continuity. */
  standalone?: boolean
  assetWorkspace?: Workspace
  kind: 'file'
  /** Stable identifier — the posix-style relative path from the workspace root. */
  id: string
  name: string
  path: string
  extension: string
  origin: FileOrigin
  /** Present when opened through the File System Access API — enables re-reading and, with permission, writing. */
  handle?: FileSystemFileHandle
  /** Present when opened through <input>/drag-drop without a handle — read-only source of truth. */
  file?: File
  size?: number
  lastModified?: number
}

export interface DirectoryNode {
  kind: 'directory'
  id: string
  name: string
  path: string
  handle?: FileSystemDirectoryHandle
  children: WorkspaceNode[]
}

export type WorkspaceNode = FileNode | DirectoryNode

export type WorkspaceSourceKind = 'directory-handle' | 'webkitdirectory' | 'files' | 'empty'

export interface Workspace {
  /** True only after a folder was granted, never inferred from loose files. */
  folderAccess?: boolean
  sourceKind: WorkspaceSourceKind
  rootName: string
  rootHandle?: FileSystemDirectoryHandle
  tree: WorkspaceNode[]
  /** Flat lookup for search/navigation without re-walking the tree. */
  filesById: Map<string, FileNode>
  /**
   * Every file in the picked folder (documents AND assets like images), keyed
   * by workspace-relative path — only populated for `webkitdirectory`/`files`
   * sources that have no live directory handle to query on demand. Used to
   * resolve `![alt](./assets/foo.png)`-style relative image references.
   * `directory-handle` workspaces resolve assets live via `rootHandle`
   * instead and leave this undefined.
   */
  assetFiles?: Map<string, File>
}

export function hasFolderAccess(workspace: Workspace | null | undefined): boolean {
  return !!workspace && (workspace.folderAccess === true || workspace.sourceKind === 'directory-handle' || workspace.sourceKind === 'webkitdirectory')
}

export type FileSystemCapability = 'access-api' | 'webkitdirectory-only' | 'unsupported'

export function detectFileSystemCapability(): FileSystemCapability {
  if (typeof window === 'undefined') return 'unsupported'
  const w = window as Partial<FileSystemAccessWindow>
  if (typeof w.showDirectoryPicker === 'function' && typeof w.showOpenFilePicker === 'function') {
    return 'access-api'
  }
  if ('webkitdirectory' in document.createElement('input')) {
    return 'webkitdirectory-only'
  }
  return 'unsupported'
}
