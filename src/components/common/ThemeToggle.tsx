import { Laptop, Moon, Sun } from 'lucide-react'
import clsx from 'clsx'
import { useSettingsStore } from '@/stores/settingsStore'
import type { ThemeMode } from '@/types/settings'
import styles from './ThemeToggle.module.css'

const OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'system', icon: Laptop, label: 'Use system theme' },
  { mode: 'light', icon: Sun, label: 'Use light theme' },
  { mode: 'dark', icon: Moon, label: 'Use dark theme' },
]

export function ThemeToggle() {
  const theme = useSettingsStore((state) => state.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)

  return (
    <div className={styles.group} role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={theme === mode}
          title={label}
          aria-label={label}
          className={clsx(styles.option, theme === mode && styles.active)}
          onClick={() => setTheme(mode)}
        >
          <Icon />
        </button>
      ))}
    </div>
  )
}
