import { isValidElement } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { reactChildrenToText } from '@/utils/reactChildrenText'
import { CopyButton } from './CopyButton'
import { MermaidDiagram } from './MermaidDiagram'
import styles from './CodeBlock.module.css'

type PreProps = ComponentPropsWithoutRef<'pre'> & { children?: ReactNode }

function getCodeElementClassName(children: ReactNode): string {
  const first = Array.isArray(children) ? children[0] : children
  if (isValidElement(first)) {
    const props = first.props as { className?: string }
    return props.className ?? ''
  }
  return ''
}

/** Overrides react-markdown's `pre` rendering for fenced code blocks: adds a language tag + copy button, and hands off `language-mermaid` blocks to the diagram renderer instead of showing raw text. */
export function CodeBlock({ children, ...rest }: PreProps) {
  const className = getCodeElementClassName(children)
  const match = /language-(\S+)/.exec(className)
  const language = match?.[1]
  const rawText = reactChildrenToText(children).replace(/\n$/, '')

  if (language === 'mermaid') {
    return <MermaidDiagram source={rawText} />
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.language}>{language ?? 'text'}</span>
        <CopyButton text={rawText} />
      </div>
      <pre {...rest} className={styles.pre}>
        {children}
      </pre>
    </div>
  )
}
