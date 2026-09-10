import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import clsx from 'clsx'
import styles from './Card.module.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  elevated?: boolean
}

export function Card({ interactive, elevated, className, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(styles.card, interactive && styles.interactive, elevated && styles.elevated, className)}
      {...rest}
    >
      {children}
    </div>
  )
}

interface CardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  elevated?: boolean
}

/** A card that behaves as a real button — for primary tappable actions like the home screen's action tiles. */
export function CardButton({ elevated, className, children, ...rest }: CardButtonProps) {
  return (
    <button
      className={clsx(styles.card, styles.cardButton, elevated && styles.elevated, className)}
      type="button"
      {...rest}
    >
      {children}
    </button>
  )
}
