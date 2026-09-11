import { create } from 'zustand'
import type { FileNode } from '@/types/filesystem'
import { isDocumentDirty, type OpenDocument } from '@/types/document'
import {
  UnsupportedFeatureError,
  canSaveInPlace,
  readFileText,
  saveFileAs,
  writeFileText,
} from '@/services/filesystem'
import { useRecentFilesStore } from './recentFilesStore'

export type SaveResult = 'saved' | 'unsupported' | 'error'
export type SaveAsResult = 'saved' | 'cancelled' | 'unsupported' | 'error'

interface DocumentState {
  documents: Map<string, OpenDocument>
  /** Open order — drives the tab strip. */
  order: string[]
  activeId: string | null
  saving: boolean
  error: string | null

  openDocument: (node: FileNode) => Promise<void>
  createNewDocument: () => string
  setActiveDocument: (id: string) => void
  updateContent: (id: string, content: string) => void
  renameDocument: (id: string, name: string) => string | null
  closeDocument: (id: string) => void
  saveDocument: (id: string) => Promise<SaveResult>
  saveDocumentAs: (id: string) => Promise<SaveAsResult>
  isDirty: (id: string) => boolean
  hasAnyUnsaved: () => boolean
  clearError: () => void
}

let newDocumentCounter = 0

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: new Map(),
  order: [],
  activeId: null,
  saving: false,
  error: null,

  openDocument: async (node) => {
    if (get().documents.has(node.id)) {
      set({ activeId: node.id })
      return
    }
    set({ error: null })
    try {
      const content = await readFileText(node)
      set((state) => {
        const documents = new Map(state.documents)
        documents.set(node.id, {
          id: node.id,
          node,
          content,
          originalContent: content,
          originalName: node.name,
          loadedAt: Date.now(),
          isNew: false,
        })
        return {
          documents,
          order: state.order.includes(node.id) ? state.order : [...state.order, node.id],
          activeId: node.id,
        }
      })
      useRecentFilesStore.getState().addRecent(node)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : `Could not open "${node.name}".` })
    }
  },

  createNewDocument: () => {
    newDocumentCounter += 1
    const name = newDocumentCounter === 1 ? 'Untitled.md' : `Untitled-${newDocumentCounter}.md`
    const id = `untitled:${Date.now()}:${newDocumentCounter}`
    const starter = '# Untitled Document\n'
    const node: FileNode = { kind: 'file', id, name, path: name, extension: 'md', origin: 'file' }
    set((state) => {
      const documents = new Map(state.documents)
      documents.set(id, { id, node, content: starter, originalContent: '', loadedAt: Date.now(), isNew: true })
      return { documents, order: [...state.order, id], activeId: id }
    })
    return id
  },

  setActiveDocument: (id) => set({ activeId: id }),

  renameDocument: (id, value) => {
    let name=value.trim()
    if (!name || /[<>:"/\\|?*]/.test(name) || [...name].some(char=>char.charCodeAt(0)<32) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) return 'Enter a valid filename without slashes or reserved characters.'
    if (!/\.(md|markdown|txt)$/i.test(name)) name+='.md'
    if (name.length>180) return 'Use a filename under 180 characters.'
    set(state=>{
      const doc=state.documents.get(id)
      if(!doc) return state
      const documents=new Map(state.documents)
      // Keep the original path/handle for local resource resolution. A renamed
      // file gets its new name through Save As, never by silently moving sources.
      documents.set(id,{...doc,originalName:doc.originalName??doc.node.name,node:{...doc.node,name,extension:name.split('.').at(-1)!.toLowerCase(),path:doc.isNew?name:doc.node.path}})
      return {documents}
    })
    return null
  },

  updateContent: (id, content) =>
    set((state) => {
      const doc = state.documents.get(id)
      if (!doc) return state
      const documents = new Map(state.documents)
      documents.set(id, { ...doc, content })
      return { documents }
    }),

  closeDocument: (id) =>
    set((state) => {
      const documents = new Map(state.documents)
      documents.delete(id)
      const order = state.order.filter((existingId) => existingId !== id)
      const activeId = state.activeId === id ? (order[order.length - 1] ?? null) : state.activeId
      return { documents, order, activeId }
    }),

  saveDocument: async (id) => {
    const doc = get().documents.get(id)
    if (!doc) return 'error'
    if (!canSaveInPlace(doc.node) || doc.originalName && doc.node.name !== doc.originalName) return 'unsupported'
    set({ saving: true, error: null })
    try {
      await writeFileText(doc.node, doc.content)
      set((state) => {
        const documents = new Map(state.documents)
        const current = documents.get(id)
        if (current) documents.set(id, { ...current, originalContent: doc.content, originalName:doc.node.name, isNew: false })
        return { documents, saving: false }
      })
      return 'saved'
    } catch (error) {
      set({ saving: false, error: error instanceof Error ? error.message : `Could not save "${doc.node.name}".` })
      return 'error'
    }
  },

  saveDocumentAs: async (id) => {
    const doc = get().documents.get(id)
    if (!doc) return 'error'
    set({ saving: true, error: null })
    try {
      const newNode = await saveFileAs(doc.content, doc.node.name)
      if (!newNode) {
        set({ saving: false })
        return 'cancelled'
      }
      set((state) => {
        const documents = new Map(state.documents)
        documents.delete(id)
        documents.set(newNode.id, {
          id: newNode.id,
          node: {...newNode,embeddedAssets:doc.node.embeddedAssets},
          content: doc.content,
          originalContent: doc.content,
          originalName: newNode.name,
          loadedAt: Date.now(),
          isNew: false,
        })
        const order = state.order.map((existingId) => (existingId === id ? newNode.id : existingId))
        const activeId = state.activeId === id ? newNode.id : state.activeId
        return { documents, order, activeId, saving: false }
      })
      useRecentFilesStore.getState().addRecent(newNode)
      return 'saved'
    } catch (error) {
      if (error instanceof UnsupportedFeatureError) {
        set({ saving: false })
        return 'unsupported'
      }
      set({ saving: false, error: error instanceof Error ? error.message : 'Save As failed.' })
      return 'error'
    }
  },

  isDirty: (id) => {
    const doc = get().documents.get(id)
    return !!doc && isDocumentDirty(doc)
  },

  hasAnyUnsaved: () => {
    for (const doc of get().documents.values()) {
      if (isDocumentDirty(doc)) return true
    }
    return false
  },

  clearError: () => set({ error: null }),
}))
