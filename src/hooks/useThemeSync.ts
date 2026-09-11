import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

/** Applies the persisted theme choice to <html data-theme>. 'system' removes the attribute so tokens.css falls back to prefers-color-scheme. */
export function useThemeSync() {
  const theme = useSettingsStore((state) => state.theme)
  const reducedMotion = useSettingsStore((state) => state.preview.reducedMotion)
  useEffect(() => { document.documentElement.dataset.reducedMotion = String(reducedMotion) }, [reducedMotion])

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => { root.dataset.resolvedTheme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme }
    sync()
    media.addEventListener('change', sync)
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
    return () => media.removeEventListener('change', sync)
  }, [theme])
}
