import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FileNode } from '@/types/filesystem'

export interface RecentFileEntry {
  id: string
  name: string
  path: string
  lastOpened: number
}

interface RecentFilesState {
  entries: RecentFileEntry[]
  addRecent: (node: FileNode) => void
  removeRecent: (path: string) => void
  clearRecent: () => void
}

const MAX_RECENTS = 12

// Only filename/path/timestamp metadata is persisted — never document content, per the app's privacy stance.
export const useRecentFilesStore = create<RecentFilesState>()(
  persist(
    (set) => ({
      entries: [],
      addRecent: (node) =>
        set((state) => {
          const withoutDuplicate = state.entries.filter((entry) => entry.path !== node.path)
          const entry: RecentFileEntry = { id: node.id, name: node.name, path: node.path, lastOpened: Date.now() }
          return { entries: [entry, ...withoutDuplicate].slice(0, MAX_RECENTS) }
        }),
      removeRecent: (path) => set((state) => ({ entries: state.entries.filter((entry) => entry.path !== path) })),
      clearRecent: () => set({ entries: [] }),
    }),
    { name: 'ultimate-markdown/recent-files', version: 1 },
  ),
)
