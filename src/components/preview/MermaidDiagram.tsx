import { useEffect, useId, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import styles from './MermaidDiagram.module.css'

interface MermaidDiagramProps {
  source: string
}

let mermaidModulePromise: Promise<typeof import('mermaid')> | null = null

/** Loaded once, lazily — mermaid is a large dependency and most documents never use it. */
function loadMermaid() {
  mermaidModulePromise ??= import('mermaid').then((mod) => {
    mod.default.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: 'var(--um-font-sans)' })
    return mod
  })
  return mermaidModulePromise
}

export function MermaidDiagram({ source }: MermaidDiagramProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setError(null)

    loadMermaid()
      .then((mod) => mod.default.render(`mermaid-${reactId}`, source))
      .then((result) => {
        if (!cancelled) setSvg(result.svg)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'This diagram could not be rendered.')
      })

    return () => {
      cancelled = true
    }
  }, [source, reactId])

  if (error) {
    return (
      <div className={styles.error}>
        <p className={styles.errorTitle}>
          <AlertTriangle aria-hidden="true" />
          Mermaid diagram could not be rendered
        </p>
        <p className={styles.errorMessage}>{error}</p>
        <pre className={styles.errorSource}>{source}</pre>
      </div>
    )
  }

  if (!svg) {
    return <div className={styles.loading}>Rendering diagram…</div>
  }

  // svg comes from mermaid's own renderer running with securityLevel:'strict' (mermaid's built-in
  // sanitization, which strips script-bearing content and disables click handlers) — this is not
  // raw markdown/HTML being trusted, so injecting the resulting SVG string is a deliberate, scoped
  // exception to "never use dangerouslySetInnerHTML without sanitization", not an oversight.
  return <div className={styles.diagram} dangerouslySetInnerHTML={{ __html: svg }} />
}
