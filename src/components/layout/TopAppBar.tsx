import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { FileEdit, FileInput, LayoutGrid, RefreshCw, Settings } from 'lucide-react'
import clsx from 'clsx'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import iconButtonStyles from '@/components/common/IconButton.module.css'
import styles from './TopAppBar.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/workspace', label: 'Workspace', icon: FileEdit, end: false },
  { to: '/import', label: 'Import', icon: FileInput, end: false },
  { to: '/converter', label: 'Converter', icon: RefreshCw, end: false },
]

interface TopAppBarProps {
  /** Extra controls rendered before the global theme/settings controls (e.g. panel toggles, view mode switch). */
  actions?: ReactNode
}

export function TopAppBar({ actions }: TopAppBarProps) {
  return (
    <header className={styles.bar}>
      <Link to="/" className={styles.brand} aria-label="Ultimate Markdown home">
        <img className={styles.mark} src={`${import.meta.env.BASE_URL}ultimate-markdown-logo.png`} alt="" width="36" height="36" />
        <span className={styles.wordmark}>Ultimate Markdown</span>
      </Link>

      <nav className={styles.nav} aria-label="Primary">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            aria-label={label}
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => clsx(styles.navItem, isActive && styles.navItemActive)}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.actions}>
        {actions}
        <a className={styles.github} href="https://github.com/shiwamshoryasharma/Ultimate-Markdown" target="_blank" rel="noopener noreferrer" aria-label="Ultimate Markdown on GitHub"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.73 1.16 1.73 1.16 1 1.73 2.63 1.23 3.27.94.1-.73.4-1.23.71-1.51-2.5-.29-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.64 0c2.15-1.46 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.03.76 2.08v3.1c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z" /></svg><span>GitHub</span></a>
        <ThemeToggle />
        <NavLink
          to="/settings"
          aria-label="Settings"
          title="Settings"
          className={({ isActive }) =>
            clsx(iconButtonStyles.button, iconButtonStyles.md, iconButtonStyles.plain, isActive && iconButtonStyles.active)
          }
        >
          <Settings />
        </NavLink>
      </div>
    </header>
  )
}
