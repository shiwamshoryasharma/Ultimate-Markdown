import type { DirectoryNode, WorkspaceNode } from '@/types/filesystem'
import { DOCUMENT_EXTENSIONS } from '@/types/filesystem'

export function getExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return ''
  return name.slice(idx + 1).toLowerCase()
}

export function isDocumentFile(name: string): boolean {
  return (DOCUMENT_EXTENSIONS as readonly string[]).includes(getExtension(name))
}

export function isHiddenName(name: string): boolean {
  return name.startsWith('.') || name === 'node_modules'
}

export function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name
}

/** Directories first, then files, both alphabetical (case-insensitive) — matches the explorer's expected reading order. */
export function sortNodes(nodes: WorkspaceNode[]): WorkspaceNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  })
}

export function countFiles(nodes: WorkspaceNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.kind === 'file') count += 1
    else count += countFiles(node.children)
  }
  return count
}

export function flattenFiles(nodes: WorkspaceNode[], into: Map<string, Extract<WorkspaceNode, { kind: 'file' }>>) {
  for (const node of nodes) {
    if (node.kind === 'file') into.set(node.id, node)
    else flattenFiles(node.children, into)
  }
  return into
}

export function findDirectory(nodes: WorkspaceNode[], path: string): DirectoryNode | null {
  for (const node of nodes) {
    if (node.kind === 'directory') {
      if (node.path === path) return node
      const found = findDirectory(node.children, path)
      if (found) return found
    }
  }
  return null
}
