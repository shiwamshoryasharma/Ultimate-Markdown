import { X } from 'lucide-react'
import clsx from 'clsx'
import { useDocumentStore } from '@/stores/documentStore'
import styles from './DocumentTabs.module.css'

export function DocumentTabs() {
  const order = useDocumentStore((state) => state.order)
  const documents = useDocumentStore((state) => state.documents)
  const activeId = useDocumentStore((state) => state.activeId)
  const setActiveDocument = useDocumentStore((state) => state.setActiveDocument)
  const closeDocument = useDocumentStore((state) => state.closeDocument)

  if (order.length === 0) return null

  const handleClose = (id: string, name: string) => {
    const doc = documents.get(id)
    const dirty = !!doc && doc.content !== doc.originalContent
    if (dirty && !window.confirm(`"${name}" has unsaved changes. Close it anyway?`)) return
    closeDocument(id)
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label="Open documents">
      {order.map((id) => {
        const doc = documents.get(id)
        if (!doc) return null
        const dirty = doc.content !== doc.originalContent
        const isActive = id === activeId
        return (
          <div key={id} role="tab" aria-selected={isActive} className={clsx(styles.tab, isActive && styles.active)}>
            <button type="button" className={styles.tabButton} onClick={() => setActiveDocument(id)} title={doc.node.path}>
              {dirty && <span className={styles.dot} aria-hidden="true" />}
              <span className={styles.label}>{doc.node.name}</span>
            </button>
            <button
              type="button"
              className={styles.closeButton}
              aria-label={`Close ${doc.node.name}`}
              onClick={() => handleClose(id, doc.node.name)}
            >
              <X />
            </button>
          </div>
        )
      })}
    </div>
  )
}
