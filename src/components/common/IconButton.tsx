import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import styles from './IconButton.module.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'plain' | 'tonal' | 'filled'
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'md', variant = 'plain', active, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={clsx(styles.button, styles[size], styles[variant], active && styles.active, className)}
      {...rest}
    >
      {icon}
    </button>
  )
})
