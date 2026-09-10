import { AlertTriangle, X } from 'lucide-react'
import { IconButton } from './IconButton'
import styles from './Toast.module.css'

interface ToastProps {
  message: string
  onDismiss: () => void
}

/** A single, dismissible inline error/notice banner — used wherever a store surfaces `error`. */
export function Toast({ message, onDismiss }: ToastProps) {
  return (
    <div className={styles.toast} role="alert">
      <AlertTriangle className={styles.icon} aria-hidden="true" />
      <span className={styles.message}>{message}</span>
      <IconButton icon={<X />} label="Dismiss" size="sm" onClick={onDismiss} />
    </div>
  )
}
