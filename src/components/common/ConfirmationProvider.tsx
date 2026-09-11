import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FileCode2, TriangleAlert, X } from 'lucide-react'
import { ConfirmationContext, type ConfirmationOptions } from '@/hooks/useConfirmation'
import { Button } from './Button'
import styles from './ConfirmationProvider.module.css'

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmationOptions | null>(null)
  const resolver = useRef<((accepted: boolean) => void) | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const id = useId()

  const confirm = useCallback((options: ConfirmationOptions) => {
    // Never overwrite an unanswered request or leave its caller waiting.
    if (resolver.current) return Promise.resolve(false)
    return new Promise<boolean>(resolve => {
      resolver.current = resolve
      setRequest(options)
    })
  }, [])

  const finish = useCallback((accepted: boolean) => {
    const resolve = resolver.current
    resolver.current = null
    dialog.current?.close()
    setRequest(null)
    resolve?.(accepted)
  }, [])

  useEffect(() => {
    if (!request) return
    const element = dialog.current!
    element.showModal()
    cancel.current?.focus()
    return () => element.close()
  }, [request])

  useEffect(() => () => {
    resolver.current?.(false)
    resolver.current = null
  }, [])

  return <ConfirmationContext.Provider value={confirm}>
    {children}
    {request && createPortal(
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-modal="true"
        onCancel={event => { event.preventDefault(); finish(false) }}
        onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') event.preventDefault()
          if (event.key === 'Tab') {
            const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
            const first = buttons[0], last = buttons[buttons.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
          }
          event.stopPropagation()
        }}>
        <div className={styles.body}>
          <div className={styles.symbol}><TriangleAlert size={24} aria-hidden="true" /></div>
          <button type="button" className={styles.close} aria-label="Cancel and keep editing" onClick={() => finish(false)}><X size={20} /></button>
          <h2 id={`${id}-title`}>{request.title}</h2>
          {request.filename && <div className={styles.file}><FileCode2 size={20} aria-hidden="true" /><span>{request.filename}</span><span className={styles.dot} title="Unsaved changes" /></div>}
          <p id={`${id}-description`}>{request.description}</p>
        </div>
        <div className={styles.actions}>
          <Button ref={cancel} type="button" variant="tonal" onClick={() => finish(false)}>{request.cancelLabel ?? 'Keep editing'}</Button>
          <Button type="button" variant="danger" onClick={() => finish(true)}>{request.confirmLabel}</Button>
        </div>
      </dialog>, document.body,
    )}
  </ConfirmationContext.Provider>
}
