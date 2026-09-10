import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

interface AppShellProps {
  topBar: ReactNode
  statusBar?: ReactNode
  children: ReactNode
}

/** Top-level page frame: fixed top app bar, flexible content area, optional status bar. Every page renders inside this. */
export function AppShell({ topBar, statusBar, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      {topBar}
      <div className={styles.content}>{children}</div>
      {statusBar}
    </div>
  )
}
