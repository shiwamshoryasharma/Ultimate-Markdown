import { create } from 'zustand'
import type { ImportedDocument, ImportBlock, ImportSession } from '@/types/import'
import { DEFAULT_DOCX_MAPPINGS, type DocxMapping } from '@/types/import'

interface ImportState {
  docxFile: File | null
  mappings: DocxMapping[]
  docxStyles: string[]
  docxImages: boolean
  setDocx: (file: File | null, mappings: DocxMapping[], styles: string[], includeImages?: boolean) => void
  closeSession: () => void
  session: ImportSession | null
  setDocuments: (documents: ImportedDocument[]) => void
  updateBlock: (docId: string, blockId: string, patch: Partial<ImportBlock>) => void
  moveBlock: (docId: string, blockId: string, direction: number) => void
  review: () => void
}
// Session content deliberately stays in memory; routing/export does not discard it.
export const useImportStore = create<ImportState>((set) => ({
  docxFile: null, mappings: DEFAULT_DOCX_MAPPINGS, docxStyles: [], docxImages: true,
  setDocx: (docxFile, mappings, docxStyles, docxImages) => set(state=>({docxFile,mappings,docxStyles,docxImages:docxImages??state.docxImages})),
  closeSession: () => set({session:null,docxFile:null,docxStyles:[],mappings:DEFAULT_DOCX_MAPPINGS}),
  session: null,
  setDocuments: documents => set({ session: { id: crypto.randomUUID(), documents, revision: 0, reviewedRevision: null } }),
  updateBlock: (docId, blockId, patch) => set(({session}) => !session ? {} : ({ session: { ...session, revision: session.revision + 1, documents: session.documents.map(doc => doc.id !== docId ? doc : { ...doc, blocks: doc.blocks.map(block => block.id === blockId ? { ...block, ...patch, id: block.id } : block) }) } })),
  moveBlock: (docId, blockId, direction) => set(({session}) => {
    if (!session) return {}
    const documents = session.documents.map(doc => {
      if (doc.id !== docId) return doc
      const blocks = [...doc.blocks], index = blocks.findIndex(b => b.id === blockId), target = index + direction
      if (index < 0 || target < 0 || target >= blocks.length) return doc
      ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
      return { ...doc, blocks }
    })
    return { session: { ...session, documents, revision: session.revision + 1 } }
  }),
  review: () => set(({session}) => session ? { session: { ...session, reviewedRevision: session.revision } } : {}),
}))
