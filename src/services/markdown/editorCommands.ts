import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

/** Wraps each selection range in `before`/`after` (e.g. **bold**, *italic*). With no selection, inserts the pair and places the cursor between them. */
export function wrapSelection(view: EditorView, before: string, after: string = before): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)
    const insert = `${before}${selected}${after}`
    return {
      changes: { from: range.from, to: range.to, insert },
      range: selected
        ? EditorSelection.range(range.from + before.length, range.from + before.length + selected.length)
        : EditorSelection.cursor(range.from + before.length),
    }
  })
  view.dispatch(state.update(tr, { scrollIntoView: true }))
  view.focus()
}

/** Toggles a literal prefix (e.g. "# ", "> ", "- ") at the start of the line each selection is on. */
export function toggleLinePrefix(view: EditorView, prefix: string): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from)
    const hasPrefix = line.text.startsWith(prefix)
    if (hasPrefix) {
      const removed = prefix.length
      return {
        changes: { from: line.from, to: line.from + removed, insert: '' },
        range: EditorSelection.range(
          Math.max(line.from, range.from - removed),
          Math.max(line.from, range.to - removed),
        ),
      }
    }
    return {
      changes: { from: line.from, to: line.from, insert: prefix },
      range: EditorSelection.range(range.from + prefix.length, range.to + prefix.length),
    }
  })
  view.dispatch(state.update(tr, { scrollIntoView: true }))
  view.focus()
}

const HEADING_LEVELS = ['#', '##', '###', '####', '#####', '######']

/** Cycles the current line through H1 → H2 → H3 → (plain paragraph) → H1 ... */
export function cycleHeading(view: EditorView): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from)
    const match = /^(#{1,6})\s/.exec(line.text)
    const currentLevel = match ? match[1].length : 0
    const nextLevel = currentLevel >= 3 ? 0 : currentLevel + 1
    const stripped = match ? line.text.slice(match[0].length) : line.text
    const newText = nextLevel === 0 ? stripped : `${HEADING_LEVELS[nextLevel - 1]} ${stripped}`
    const delta = newText.length - line.text.length
    return {
      changes: { from: line.from, to: line.to, insert: newText },
      range: EditorSelection.range(Math.max(line.from, range.from + delta), Math.max(line.from, range.to + delta)),
    }
  })
  view.dispatch(state.update(tr, { scrollIntoView: true }))
  view.focus()
}

export function insertCodeBlock(view: EditorView): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)
    if (selected) {
      const insert = `\`\`\`\n${selected}\n\`\`\``
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + insert.length),
      }
    }
    const insert = '```\n\n```'
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + 4),
    }
  })
  view.dispatch(state.update(tr, { scrollIntoView: true }))
  view.focus()
}

export function insertLink(view: EditorView): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)
    const text = selected || 'title'
    const insert = `[${text}](https://example.com)`
    const urlStart = range.from + text.length + 3
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlStart, urlStart + 'https://example.com'.length),
    }
  })
  view.dispatch(state.update(tr, { scrollIntoView: true }))
  view.focus()
}

export function insertImage(view: EditorView): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)
    const alt = selected || 'alt'
    const insert = `![${alt}](image.png)`
    const pathStart = range.from + alt.length + 4
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(pathStart, pathStart + 'image.png'.length),
    }
  })
  view.dispatch(state.update(tr, { scrollIntoView: true }))
  view.focus()
}

const TABLE_TEMPLATE = '| Name | Value |\n| --- | --- |\n| A | 1 |\n| B | 2 |\n'

export function insertTable(view: EditorView): void {
  insertBlockAtCursor(view, TABLE_TEMPLATE)
}

export function insertHorizontalRule(view: EditorView): void {
  insertBlockAtCursor(view, '\n---\n')
}

/** Inserts a `[^1]` reference at the cursor and its `[^1]: ` definition line at the end of the document, in one transaction. */
export function insertFootnote(view: EditorView): void {
  const { state } = view
  const cursor = state.selection.main.from
  const docEnd = state.doc.length
  const refInsert = '[^1]'
  const defInsert = '\n\n[^1]: '
  const changes = state.changes([
    { from: cursor, to: cursor, insert: refInsert },
    { from: docEnd, to: docEnd, insert: defInsert },
  ])
  const newDocLength = docEnd + refInsert.length + defInsert.length
  view.dispatch({ changes, selection: EditorSelection.cursor(newDocLength), scrollIntoView: true })
  view.focus()
}

export function insertMath(view: EditorView): void {
  wrapSelection(view, '$')
}

function insertBlockAtCursor(view: EditorView, block: string, skipFocus = false): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const needsLeadingBreak = range.from > 0 && state.doc.sliceString(range.from - 1, range.from) !== '\n'
    const insert = (needsLeadingBreak ? '\n' : '') + block
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + insert.length),
    }
  })
  view.dispatch(state.update(tr, { scrollIntoView: true }))
  if (!skipFocus) view.focus()
}

export function toggleBulletList(view: EditorView): void {
  toggleLinePrefix(view, '- ')
}

export function toggleNumberedList(view: EditorView): void {
  toggleLinePrefix(view, '1. ')
}

export function toggleTaskList(view: EditorView): void {
  toggleLinePrefix(view, '- [ ] ')
}

export function toggleQuote(view: EditorView): void {
  toggleLinePrefix(view, '> ')
}
