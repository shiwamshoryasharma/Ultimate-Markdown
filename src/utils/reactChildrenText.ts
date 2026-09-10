import type { ReactNode } from 'react'
import { isValidElement } from 'react'

/** Reconstructs the plain text of a React tree — used to recover a code block's raw source after rehype-highlight has wrapped it in <span> tokens. */
export function reactChildrenToText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(reactChildrenToText).join('')
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode }
    return reactChildrenToText(props.children)
  }
  return ''
}
