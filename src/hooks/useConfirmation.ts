import { createContext, useContext } from 'react'

export interface ConfirmationOptions {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  filename?: string
}

export const ConfirmationContext = createContext<((options: ConfirmationOptions) => Promise<boolean>) | null>(null)

export function useConfirmation() {
  const confirm = useContext(ConfirmationContext)
  if (!confirm) throw new Error('ConfirmationProvider is required.')
  return confirm
}
