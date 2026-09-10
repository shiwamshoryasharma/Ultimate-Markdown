import { create } from 'zustand'
import type { FileSystemCapability, Workspace, WorkspaceNode, WorkspaceSourceKind } from '@/types/filesystem'
import { detectFileSystemCapability } from '@/types/filesystem'
import {
  flattenFiles,
  pickDirectory,
  pickSingleFile,
  readDroppedItems,
  releaseAllLocalAssets,
  sortNodes,
} from '@/services/filesystem'
import { useDocumentStore } from './documentStore'
import { initialDocumentLinkMappings } from '@/services/filesystem/documentLinkProfiles'

type LoadStatus = 'idle' | 'loading' | 'error'

interface WorkspaceState {
  linkOverrides: Record<string, string>
  setLinkOverride: (from: string, target: string, replacement: string) => void
  workspace: Workspace | null
  status: LoadStatus
  error: string | null
  capability: FileSystemCapability

  openFile: () => Promise<void>
  openFolder: () => Promise<void>
  openDropped: (dataTransfer: DataTransfer) => Promise<void>
  closeWorkspace: () => void
  clearError: () => void
  attachAssetFolder: (documentId: string) => Promise<void>
}

function buildWorkspace(
  tree: WorkspaceNode[],
  sourceKind: WorkspaceSourceKind,
  rootName: string,
  rootHandle?: FileSystemDirectoryHandle,
  assetFiles?: Map<string, File>,
): Workspace {
  const sorted = sortNodes(tree)
  return {
    sourceKind,
    rootName,
    rootHandle,
    tree: sorted,
    filesById: flattenFiles(sorted, new Map()),
    assetFiles,
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  linkOverrides: {},
  setLinkOverride: (from, target, replacement) => set((state) => {
    const linkOverrides = { ...state.linkOverrides }
    if (replacement) linkOverrides[`${from}::${target}`] = replacement
    else delete linkOverrides[`${from}::${target}`]
    return { linkOverrides }
  }),
  workspace: null,
  status: 'idle',
  error: null,
  capability: detectFileSystemCapability(),

  openFile: async () => {
    set({ status: 'loading', error: null })
    try {
      const node = await pickSingleFile()
      set({ status: 'idle' })
      if (!node) return
      node.standalone = true
      node.id = `single:${crypto.randomUUID()}`
      await useDocumentStore.getState().openDocument(node)
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Could not open the file.' })
    }
  },

  openFolder: async () => {
    set({ status: 'loading', error: null })
    try {
      const picked = await pickDirectory()
      if (!picked) {
        set({ status: 'idle' })
        return
      }
      if (picked.tree.length === 0) {
        set({ status: 'idle', error: `No Markdown files were found in "${picked.rootName}".` })
        return
      }
      releaseAllLocalAssets()
      const workspace = buildWorkspace(picked.tree, picked.sourceKind, picked.rootName, picked.rootHandle, picked.assetFiles)
      set({ workspace, status: 'idle', linkOverrides: initialDocumentLinkMappings(workspace) })
      const first = workspace.filesById.values().next().value
      if (first) await useDocumentStore.getState().openDocument(first)
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Could not open the folder.' })
    }
  },

  openDropped: async (dataTransfer) => {
    set({ status: 'loading', error: null })
    try {
      const picked = await readDroppedItems(dataTransfer)
      if (!picked) {
        set({ status: 'idle', error: 'No Markdown (.md/.markdown/.txt) files were found in what you dropped.' })
        return
      }

      if (picked.sourceKind === 'directory-handle' || picked.folderAccess) {
        releaseAllLocalAssets()
        const workspace = buildWorkspace(picked.tree, picked.sourceKind, picked.rootName, picked.rootHandle, picked.assetFiles)
        workspace.folderAccess = true
        set({ workspace, status: 'idle', linkOverrides: initialDocumentLinkMappings(workspace) })
        const first = workspace.filesById.values().next().value
        if (first) await docStoreOpen(first)
        return
      }

      // Loose file(s): open each directly and fold them into the current (or a new ad hoc) workspace tree.
      const docStore = useDocumentStore.getState()
      for (const node of picked.tree) {
        if (node.kind === 'file') { node.standalone = true; await docStore.openDocument(node) }
      }
      set((state) => {
        const existing = state.workspace
        if (existing && existing.sourceKind !== 'directory-handle') {
          const mergedTree = sortNodes([...existing.tree, ...picked.tree])
          return {
            workspace: buildWorkspace(
              mergedTree,
              'files',
              existing.rootName,
              undefined,
              picked.assetFiles ?? existing.assetFiles,
            ),
            status: 'idle',
          }
        }
        if (!existing) {
          return {
            workspace: buildWorkspace(picked.tree, 'files', picked.rootName, undefined, picked.assetFiles),
            status: 'idle',
          }
        }
        return { status: 'idle' }
      })
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Could not read the dropped items.' })
    }
  },

  closeWorkspace: () => {
    releaseAllLocalAssets()
    set({ workspace: null, linkOverrides: {} })
  },

  clearError: () => set({ error: null }),
  attachAssetFolder: async (documentId) => {
    try {
      const picked = await pickDirectory()
      if (!picked) return
      const assets = buildWorkspace(picked.tree, picked.sourceKind, picked.rootName, picked.rootHandle, picked.assetFiles)
      useDocumentStore.setState((state) => {
        const doc = state.documents.get(documentId)
        if (!doc) return state
        const documents = new Map(state.documents)
        documents.set(documentId, { ...doc, node: { ...doc.node, assetWorkspace: assets } })
        return { documents }
      })
    } catch (error) { set({ error: error instanceof Error ? error.message : 'Could not connect the image folder.' }) }
  },
}))

async function docStoreOpen(node: import('@/types/filesystem').FileNode) {
  await useDocumentStore.getState().openDocument(node)
}
