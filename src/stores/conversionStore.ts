import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CONVERSION, type ConversionSettings } from '@/types/conversion'

export const useConversionStore = create<{ settings: ConversionSettings; update: (patch: Partial<ConversionSettings>) => void }>()(
  persist((set) => ({ settings: DEFAULT_CONVERSION, update: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })) }), {
    name: 'ultimate-markdown/conversion-v1',
    version: 2,
    migrate: (persisted) => {
      const previous = (persisted as { settings?: Partial<ConversionSettings> })?.settings ?? {}
      return { settings: { ...DEFAULT_CONVERSION, ...previous, sourceMode: 'linked-chain', linkedDocumentSeparation: 'new-page', fontFamily: previous.fontFamily === 'system-ui' ? 'Arial' : previous.fontFamily ?? 'Arial' } }
    },
    merge: (persisted, current) => ({ ...current, settings: { ...DEFAULT_CONVERSION, ...(persisted as { settings?: Partial<ConversionSettings> })?.settings } }),
    partialize: (state) => ({ settings: { ...state.settings, sourceMode: 'linked-chain', header: { ...state.settings.header, text: '' }, footer: { ...state.settings.footer, customText: '' } } }),
  }),
)
