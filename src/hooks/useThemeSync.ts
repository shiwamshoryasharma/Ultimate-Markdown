import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

/** Applies the persisted theme choice to <html data-theme>. 'system' removes the attribute so tokens.css falls back to prefers-color-scheme. */
export function useThemeSync() {
  const theme = useSettingsStore((state) => state.theme)
  const reducedMotion = useSettingsStore((state) => state.preview.reducedMotion)
  useEffect(() => { document.documentElement.dataset.reducedMotion = String(reducedMotion) }, [reducedMotion])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])
}
