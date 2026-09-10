import type { WorkspaceNode } from '@/types/filesystem'

/** Prunes a workspace tree down to files whose name matches `query`, plus their ancestor directories (for auto-expand). */
export function filterTree(nodes: WorkspaceNode[], query: string): { nodes: WorkspaceNode[]; matchedDirIds: Set<string> } {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return { nodes, matchedDirIds: new Set() }

  const matchedDirIds = new Set<string>()

  function walk(list: WorkspaceNode[]): WorkspaceNode[] {
    const result: WorkspaceNode[] = []
    for (const node of list) {
      if (node.kind === 'file') {
        if (node.name.toLowerCase().includes(trimmed)) result.push(node)
      } else {
        const children = walk(node.children)
        if (children.length > 0) {
          matchedDirIds.add(node.id)
          result.push({ ...node, children })
        }
      }
    }
    return result
  }

  return { nodes: walk(nodes), matchedDirIds }
}

export function collectAllDirectoryIds(nodes: WorkspaceNode[], into: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    if (node.kind === 'directory') {
      into.add(node.id)
      collectAllDirectoryIds(node.children, into)
    }
  }
  return into
}
