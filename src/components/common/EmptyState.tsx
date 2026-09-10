import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

/** Used for every "nothing here yet" moment: no document selected, no search results, permission required, etc. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
