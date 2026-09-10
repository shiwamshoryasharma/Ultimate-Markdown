import { useMemo, useState } from 'react'
import type { FileNode, WorkspaceNode } from '@/types/filesystem'
import { collectAllDirectoryIds, filterTree } from '@/utils/treeFilter'
import { TreeRow } from './TreeRow'

interface FileTreeProps {
  nodes: WorkspaceNode[]
  activeId: string | null
  dirtyIds: Set<string>
  filterQuery: string
  onSelectFile: (node: FileNode) => void
}

export function FileTree({ nodes, activeId, dirtyIds, filterQuery, onSelectFile }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => collectAllDirectoryIds(nodes))

  const { nodes: filteredNodes, matchedDirIds } = useMemo(() => filterTree(nodes, filterQuery), [nodes, filterQuery])

  const onToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div role="tree" aria-label="Markdown files">
      {filteredNodes.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          activeId={activeId}
          dirtyIds={dirtyIds}
          expanded={expanded}
          forceExpandedIds={matchedDirIds}
          onToggle={onToggle}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  )
}
