import { useDocumentStore } from '@/stores/documentStore'
import { resolveDocumentPath } from '@/services/markdown/documentLinks'
import type { Workspace } from '@/types/filesystem'

/** Explicit mapping: equal filenames in different folders are never guessed. */
export function attachImage(documentId: string, src: string, workspace: Workspace | null) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.hidden = true
  input.addEventListener('cancel', () => input.remove(), { once: true })
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    useDocumentStore.setState((state) => {
      const doc = state.documents.get(documentId)
      if (!doc) return state
      const path = resolveDocumentPath(doc.node.path, src)
      if (!path) return state
      const base = doc.node.assetWorkspace ?? workspace
      const assetFiles = new Map(base?.assetFiles)
      assetFiles.set(path, file)
      const assets: Workspace = { sourceKind: 'files', rootName: 'Attached images', tree: [], filesById: new Map(), ...base, assetFiles }
      const documents = new Map(state.documents)
      documents.set(documentId, { ...doc, node: { ...doc.node, assetWorkspace: assets } })
      return { documents }
    })
  }, { once: true })
  document.body.append(input)
  input.click()
}
