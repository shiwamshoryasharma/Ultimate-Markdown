import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'
import styles from './BottomSheet.module.css'

interface BottomSheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** One UI-style bottom sheet — used for mobile-only transient tools (e.g. the TOC) instead of a full page or a desktop-style dropdown. */
export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.handle} />
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <IconButton icon={<X />} label="Close" size="sm" onClick={onClose} />
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}
