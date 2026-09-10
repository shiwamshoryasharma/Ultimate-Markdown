import type { ReactNode } from 'react'
import styles from './StatusBar.module.css'

interface StatusBarProps {
  left?: ReactNode
  right?: ReactNode
}

export function StatusBar({ left, right }: StatusBarProps) {
  return (
    <footer className={styles.bar}>
      <div className={styles.side}>{left}</div>
      <div className={styles.side}>{right}</div>
    </footer>
  )
}
