import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import clsx from 'clsx'
import type { FileNode, WorkspaceNode } from '@/types/filesystem'
import styles from './FileTree.module.css'

interface TreeRowProps {
  node: WorkspaceNode
  depth: number
  activeId: string | null
  dirtyIds: Set<string>
  expanded: Set<string>
  forceExpandedIds: Set<string>
  onToggle: (id: string) => void
  onSelectFile: (node: FileNode) => void
}

export function TreeRow({ node, depth, activeId, dirtyIds, expanded, forceExpandedIds, onToggle, onSelectFile }: TreeRowProps) {
  const indent = 8 + depth * 18

  if (node.kind === 'file') {
    const isActive = node.id === activeId
    const isDirty = dirtyIds.has(node.id)
    return (
      <button
        type="button"
        className={clsx(styles.row, styles.fileRow, isActive && styles.active)}
        style={{ paddingLeft: indent + 22 }}
        onClick={() => onSelectFile(node)}
        title={node.path}
      >
        <File className={styles.fileIcon} aria-hidden="true" />
        <span className={styles.label}>{node.name}</span>
        {isDirty && <span className={styles.dirtyDot} aria-label="Unsaved changes" title="Unsaved changes" />}
      </button>
    )
  }

  const isOpen = expanded.has(node.id) || forceExpandedIds.has(node.id)

  return (
    <div>
      <button
        type="button"
        className={clsx(styles.row, styles.folderRow)}
        style={{ paddingLeft: indent }}
        onClick={() => onToggle(node.id)}
        aria-expanded={isOpen}
      >
        <ChevronRight className={clsx(styles.chevron, isOpen && styles.chevronOpen)} aria-hidden="true" />
        {isOpen ? <FolderOpen className={styles.folderIcon} aria-hidden="true" /> : <Folder className={styles.folderIcon} aria-hidden="true" />}
        <span className={styles.label}>{node.name}</span>
      </button>
      {isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              dirtyIds={dirtyIds}
              expanded={expanded}
              forceExpandedIds={forceExpandedIds}
              onToggle={onToggle}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}
