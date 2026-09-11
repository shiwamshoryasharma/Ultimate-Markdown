import { isDocumentDirty } from '@/types/document'
import { useState } from 'react'
import { FolderOpen, Search, X } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { IconButton } from '@/components/common/IconButton'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useDocumentStore } from '@/stores/documentStore'
import type { FileNode } from '@/types/filesystem'
import { FileTree } from './FileTree'
import styles from './ExplorerPanel.module.css'

export function ExplorerPanel() {
  const workspace = useWorkspaceStore((state) => state.workspace)
  const openFolder = useWorkspaceStore((state) => state.openFolder)
  const wsStatus = useWorkspaceStore((state) => state.status)
  const activeId = useDocumentStore((state) => state.activeId)
  const documents = useDocumentStore((state) => state.documents)
  const openDocument = useDocumentStore((state) => state.openDocument)
  const [query, setQuery] = useState('')

  const dirtyIds = new Set<string>()
  for (const [id, doc] of documents) {
    if (isDocumentDirty(doc)) dirtyIds.add(id)
  }

  const handleSelect = (node: FileNode) => {
    void openDocument(node)
  }

  const hasFiles = !!workspace && workspace.tree.length > 0

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{workspace ? workspace.rootName : 'Explorer'}</span>
        <IconButton
          icon={<FolderOpen />}
          label="Open a folder"
          size="sm"
          onClick={() => void openFolder()}
          disabled={wsStatus === 'loading'}
        />
      </div>

      {hasFiles && (
        <div className={styles.searchBox}>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            className={styles.searchInput}
            placeholder="Search files"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search files in this folder"
          />
          {query && <IconButton icon={<X />} label="Clear search" size="sm" onClick={() => setQuery('')} />}
        </div>
      )}

      <div className={styles.treeScroll}>
        {!hasFiles ? (
          <EmptyState
            icon={<FolderOpen />}
            title="No folder open"
            description="Open a folder to browse its Markdown files here."
          />
        ) : (
          <FileTree
            key={`${workspace.sourceKind}:${workspace.rootName}:${workspace.tree.length}`}
            nodes={workspace.tree}
            activeId={activeId}
            dirtyIds={dirtyIds}
            filterQuery={query}
            onSelectFile={handleSelect}
          />
        )}
      </div>
    </aside>
  )
}
