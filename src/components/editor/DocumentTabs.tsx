import { isDocumentDirty } from '@/types/document'
import { FileCode2, FileText, Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { useDocumentStore } from '@/stores/documentStore'
import { useConfirmation } from '@/hooks/useConfirmation'
import styles from './DocumentTabs.module.css'

export function DocumentTabs() {
  const confirm = useConfirmation()
  const order = useDocumentStore((state) => state.order)
  const documents = useDocumentStore((state) => state.documents)
  const activeId = useDocumentStore((state) => state.activeId)
  const setActiveDocument = useDocumentStore((state) => state.setActiveDocument)
  const closeDocument = useDocumentStore((state) => state.closeDocument)
  const renameDocument = useDocumentStore((state) => state.renameDocument)
  const [renaming,setRenaming]=useState<string|null>(null)
  const [name,setName]=useState(''),[error,setError]=useState('')

  const create=()=>{useDocumentStore.getState().createNewDocument();requestAnimationFrame(()=>document.querySelector<HTMLElement>('.cm-content')?.focus())}

  const handleClose = async (id: string, name: string) => {
    const doc = documents.get(id)
    const dirty = !!doc && isDocumentDirty(doc)
    if (dirty && !await confirm({title: 'Discard unsaved changes?', filename: name, description: 'This document has changes that haven’t been saved. Closing it will discard those changes.', confirmLabel: 'Discard changes'})) return
    closeDocument(id)
  }
  const startRename=(id:string,currentName:string)=>{setRenaming(id);setName(currentName);setError('')}
  const finishRename=()=>{if(!renaming)return;const reason=renameDocument(renaming,name);if(reason)setError(reason);else{setRenaming(null);setError('')}}

  return (
    <div className={styles.strip} role="tablist" aria-label="Open documents">
      <div className={styles.tabs}>
      {order.map((id) => {
        const doc = documents.get(id)
        if (!doc) return null
        const dirty = isDocumentDirty(doc)
        const isActive = id === activeId
        return (
          <div key={id} role="tab" aria-selected={isActive} className={clsx(styles.tab, isActive && styles.active)}>
            {renaming===id?<div className={styles.rename}><input aria-label="Document filename" value={name} ref={input=>{if(input&&document.activeElement!==input){input.focus();input.setSelectionRange(0,input.value.lastIndexOf('.')>0?input.value.lastIndexOf('.'):input.value.length)}}} onChange={event=>{setName(event.target.value);setError('')}} onBlur={()=>{if(!error)finishRename()}} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();const reason=renameDocument(id,name);if(reason){setError(reason);event.stopPropagation()}else{setRenaming(null);setError('')}}if(event.key==='Enter'){event.preventDefault();finishRename()}if(event.key==='Escape'){event.preventDefault();setRenaming(null);setError('')}}} aria-invalid={!!error} title={error||'Enter to rename · Escape to cancel'}/>{error&&<span role="alert" className={styles.renameError}>{error}</span>}</div>:<button type="button" className={styles.tabButton} onClick={() => setActiveDocument(id)} onDoubleClick={()=>startRename(id,doc.node.name)} onKeyDown={event=>{if(event.key==='F2'){event.preventDefault();startRename(id,doc.node.name)}}} title={`${doc.node.path}\nDouble-click or press F2 to rename. Save downloads the new filename. Save As chooses a location.`}>
              {doc.node.extension==='txt'?<FileText className={styles.fileIcon} aria-hidden="true"/>:<FileCode2 className={styles.fileIcon} aria-hidden="true"/>}
              {dirty && <span className={styles.dot} aria-hidden="true" />}
              <span className={styles.label}>{doc.node.name}</span>
            </button>}
            {renaming!==id&&<button type="button" className={styles.renameButton} aria-label={`Rename ${doc.node.name}`} title="Rename document" onClick={()=>startRename(id,doc.node.name)}><Pencil/></button>}
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
      <div className={styles.tabActions}><button type="button" className={styles.addButton} aria-label="New Markdown file" title="New Markdown file (Ctrl+Alt+N)" aria-keyshortcuts="Control+Alt+N" onClick={create}><Plus/><span>New Markdown</span></button></div>
    </div>
  )
}
