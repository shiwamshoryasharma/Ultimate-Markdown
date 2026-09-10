import type { EditorView } from '@codemirror/view'
import type { EditorSettings } from '@/types/settings'
import { useCodeMirror } from './useCodeMirror'
import styles from './MarkdownEditor.module.css'

interface MarkdownEditorProps {
  initialValue: string
  onChange: (value: string) => void
  settings: EditorSettings
  onViewReady?: (view: EditorView | null) => void
}

/** Mount one of these per document (key it by document id) — see useCodeMirror for why. */
export function MarkdownEditor({ initialValue, onChange, settings, onViewReady }: MarkdownEditorProps) {
  const { containerRef } = useCodeMirror({ initialValue, onChange, settings, onViewReady })
  return <div ref={containerRef} className={styles.editor} />
}
