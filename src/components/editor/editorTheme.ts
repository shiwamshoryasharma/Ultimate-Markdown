import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/** CodeMirror chrome (background, cursor, gutter, selection) mapped onto the app's design tokens so the editor blends into both themes. */
export const umEditorTheme = EditorView.theme({
  '&': {
    color: 'var(--um-text)',
    backgroundColor: 'var(--um-surface)',
    height: '100%',
    fontSize: 'var(--cm-font-size, 15px)',
  },
  '.cm-content': {
    fontFamily: 'var(--um-font-mono)',
    caretColor: 'var(--um-primary)',
    padding: '16px 0',
    lineHeight: 'var(--cm-line-height, 1.6)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--um-primary)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--um-selection)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--um-surface)',
    color: 'var(--um-text-tertiary)',
    border: 'none',
    borderRight: '1px solid var(--um-outline-variant)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--um-surface-container)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--um-surface-container)',
    color: 'var(--um-text-secondary)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 10px 0 12px',
  },
  '.cm-scroller': {
    fontFamily: 'var(--um-font-mono)',
    overflow: 'auto',
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: 'var(--um-surface-container-high)',
    outline: '1px solid var(--um-outline)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--um-warning-container)',
    outline: '1px solid var(--um-warning)',
  },
  '.cm-searchMatch-selected': {
    backgroundColor: 'var(--um-primary-container)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--um-surface-container)',
    color: 'var(--um-text)',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid var(--um-outline-variant)',
  },
  '.cm-panel input, .cm-panel button': {
    fontFamily: 'var(--um-font-sans)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--um-surface-container-high)',
    border: '1px solid var(--um-outline)',
    borderRadius: 'var(--um-radius-sm)',
  },
})

/** Markdown syntax colors — moderate contrast so it reads fine in both light and dark without a separate dark stylesheet. */
export const umHighlightStyle = HighlightStyle.define([
  { tag: t.heading, color: 'var(--um-primary)', fontWeight: '700' },
  { tag: t.strong, fontWeight: '700', color: 'var(--um-text)' },
  { tag: t.emphasis, fontStyle: 'italic', color: 'var(--um-text)' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--um-text-tertiary)' },
  { tag: t.link, color: 'var(--um-info)', textDecoration: 'underline' },
  { tag: t.url, color: 'var(--um-info)' },
  { tag: t.monospace, color: 'var(--um-secondary)', fontFamily: 'var(--um-font-mono)' },
  { tag: t.quote, color: 'var(--um-text-secondary)', fontStyle: 'italic' },
  { tag: t.list, color: 'var(--um-primary)' },
  { tag: t.processingInstruction, color: 'var(--um-text-tertiary)' },
  { tag: t.contentSeparator, color: 'var(--um-text-tertiary)' },
  { tag: t.meta, color: 'var(--um-text-tertiary)' },
])

export const umMarkdownHighlighting = syntaxHighlighting(umHighlightStyle, { fallback: true })
