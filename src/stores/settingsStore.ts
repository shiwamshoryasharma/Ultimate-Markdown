import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, EditorSettings, ExportSettings, PreviewSettings, ThemeMode } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/types/settings'

interface SettingsState extends AppSettings {
  setTheme: (theme: ThemeMode) => void
  updateEditorSettings: (patch: Partial<EditorSettings>) => void
  updatePreviewSettings: (patch: Partial<PreviewSettings>) => void
  updateExportSettings: (patch: Partial<ExportSettings>) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setTheme: (theme) => set({ theme }),
      updateEditorSettings: (patch) => set((state) => ({ editor: { ...state.editor, ...patch } })),
      updatePreviewSettings: (patch) => set((state) => ({ preview: { ...state.preview, ...patch } })),
      updateExportSettings: (patch) => set((state) => ({ export: { ...state.export, ...patch } })),
      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'ultimate-markdown/settings',
      version: 1,
      merge: (persisted, current) => {
        const saved = persisted as Partial<AppSettings> | undefined
        return { ...current, ...saved, editor: { ...DEFAULT_SETTINGS.editor, ...saved?.editor }, preview: { ...DEFAULT_SETTINGS.preview, ...saved?.preview }, export: { ...DEFAULT_SETTINGS.export, ...saved?.export } }
      },
    },
  ),
)
