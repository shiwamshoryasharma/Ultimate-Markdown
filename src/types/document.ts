import type { FileNode } from './filesystem'

export interface OpenDocument {
  id: string
  node: FileNode
  content: string
  originalContent: string
  loadedAt: number
  /** true for "New Markdown Document" that has never been saved anywhere yet. */
  isNew: boolean
}

export function isDocumentDirty(doc: OpenDocument): boolean {
  return doc.content !== doc.originalContent
}
