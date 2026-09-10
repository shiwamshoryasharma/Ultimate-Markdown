import { Children, isValidElement, useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import styles from './Select.module.css'

interface SelectProps {
  className?: string
  children: ReactNode
  value?: string | number
  onChange?: (event: { target: { value: string } }) => void
  disabled?: boolean
  id?: string
  name?: string
  'aria-label'?: string
}
interface Option { value: string; label: ReactNode; text: string; disabled: boolean }
export function Select({ className, children, value, onChange, disabled, id, name, 'aria-label': ariaLabel }: SelectProps) {
  const options: Option[] = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{value?: string | number; children?: ReactNode; disabled?: boolean}>(child)) return []
    const text = Children.toArray(child.props.children).join('')
    return [{ value: String(child.props.value ?? text), label: child.props.children, text, disabled: !!child.props.disabled }]
  })
  const generatedId = useId()
  const listId = 'select-' + generatedId
  const root = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<CSSProperties>({})
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const selected = Math.max(0, options.findIndex((option) => option.value === String(value)))
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = button.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom - 14, above = rect.top - 14
      const upward = below < 250 && above > below
      const height = Math.min(280, Math.max(60, upward ? above : below))
      setPosition({ width: Math.min(Math.max(rect.width, 200), window.innerWidth - 24), left: Math.max(12, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 200) - 12)), maxHeight: height, ...(upward ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    const item = menu.current?.querySelector<HTMLElement>('[data-highlighted="true"]')
    if (item && menu.current) {
      if (item.offsetTop < menu.current.scrollTop) menu.current.scrollTop = item.offsetTop
      else if (item.offsetTop + item.offsetHeight > menu.current.scrollTop + menu.current.clientHeight) menu.current.scrollTop = item.offsetTop + item.offsetHeight - menu.current.clientHeight
    }
  }, [highlight, open])
  const choose = (index: number) => { const option = options[index]; if (!option || option.disabled) return; onChange?.({ target: { value: option.value } }); setOpen(false); button.current?.focus() }
  const move = (direction: number) => {
    let index = highlight
    for (let i = 0; i < options.length; i++) { index = (index + direction + options.length) % options.length; if (!options[index].disabled) { setHighlight(index); break } }
  }
  const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') { setOpen(false); event.preventDefault() }
    else if (event.key === 'Tab') setOpen(false)
    else if (['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); if (!open) { setOpen(true); setHighlight(selected) } else move(event.key === 'ArrowDown' ? 1 : -1) }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setOpen(true); const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0); setHighlight((event.key === 'Home' ? enabled[0] : enabled.at(-1)) ?? 0) }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (open) choose(highlight); else { setOpen(true); setHighlight(selected) } }
    else if (event.key.length === 1) { const index = options.findIndex((option) => !option.disabled && option.text.toLowerCase().startsWith(event.key.toLowerCase())); if (index >= 0) { setOpen(true); setHighlight(index) } }
  }
  return <span className={styles.root} ref={root}>
    {name && <input type="hidden" name={name} value={value ?? ''} />}
    <button id={id} ref={button} type="button" role="combobox" aria-label={ariaLabel} aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" aria-activedescendant={open ? listId + '-' + highlight : undefined} disabled={disabled} className={[styles.trigger, className].filter(Boolean).join(' ')} onKeyDown={keys} onClick={() => { setOpen(!open); setHighlight(selected) }}>
      <span>{options[selected]?.label ?? 'Select'}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={menu} id={listId} role="listbox" aria-label={ariaLabel} className={styles.menu} style={position}>{options.map((option, index) => <div id={listId + '-' + index} key={option.value} role="option" aria-selected={index === selected} aria-disabled={option.disabled || undefined} data-highlighted={index === highlight} className={styles.option} onPointerMove={() => { if (!option.disabled) setHighlight(index) }} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
      <span>{option.label}</span>{index === selected && <Check size={15} aria-hidden="true" />}
    </div>)}</div>, document.fullscreenElement ?? document.body)}
  </span>
}
