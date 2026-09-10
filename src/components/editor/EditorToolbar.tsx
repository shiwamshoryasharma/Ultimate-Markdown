import type { EditorView } from '@codemirror/view'
import { redo, undo } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import {
  Bold,
  Code,
  Code2,
  Heading,
  Image,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Search,
  Sigma,
  Strikethrough,
  Superscript,
  Table,
  Undo2,
} from 'lucide-react'
import { IconButton } from '@/components/common/IconButton'
import {
  cycleHeading,
  insertCodeBlock,
  insertFootnote,
  insertHorizontalRule,
  insertImage,
  insertLink,
  insertMath,
  insertTable,
  toggleBulletList,
  toggleNumberedList,
  toggleQuote,
  toggleTaskList,
  wrapSelection,
} from '@/services/markdown/editorCommands'
import styles from './EditorToolbar.module.css'

interface EditorToolbarProps {
  getView: () => EditorView | null
}

interface ToolbarAction {
  label: string
  icon: React.ReactNode
  run: (view: EditorView) => void
}

export function EditorToolbar({ getView }: EditorToolbarProps) {
  const run = (action: (view: EditorView) => void) => {
    const view = getView()
    if (view) action(view)
  }

  const groups: ToolbarAction[][] = [
    [
      { label: 'Undo', icon: <Undo2 />, run: (v) => undo(v) },
      { label: 'Redo', icon: <Redo2 />, run: (v) => redo(v) },
    ],
    [
      { label: 'Heading', icon: <Heading />, run: cycleHeading },
      { label: 'Bold', icon: <Bold />, run: (v) => wrapSelection(v, '**') },
      { label: 'Italic', icon: <Italic />, run: (v) => wrapSelection(v, '*') },
      { label: 'Strikethrough', icon: <Strikethrough />, run: (v) => wrapSelection(v, '~~') },
      { label: 'Inline code', icon: <Code />, run: (v) => wrapSelection(v, '`') },
    ],
    [
      { label: 'Quote', icon: <Quote />, run: toggleQuote },
      { label: 'Bullet list', icon: <List />, run: toggleBulletList },
      { label: 'Numbered list', icon: <ListOrdered />, run: toggleNumberedList },
      { label: 'Task list', icon: <ListChecks />, run: toggleTaskList },
    ],
    [
      { label: 'Link', icon: <Link2 />, run: insertLink },
      { label: 'Image', icon: <Image />, run: insertImage },
      { label: 'Code block', icon: <Code2 />, run: insertCodeBlock },
      { label: 'Table', icon: <Table />, run: insertTable },
      { label: 'Horizontal rule', icon: <Minus />, run: insertHorizontalRule },
      { label: 'Footnote', icon: <Superscript />, run: insertFootnote },
      { label: 'Math', icon: <Sigma />, run: insertMath },
    ],
    [
      { label: 'Find & Replace', icon: <Search />, run: (v) => openSearchPanel(v) },
    ],
  ]

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
      {groups.map((group, groupIndex) => (
        <div className={styles.group} key={groupIndex}>
          {group.map((action) => (
            <IconButton
              key={action.label}
              icon={action.icon}
              label={action.label}
              size="sm"
              onClick={() => run(action.run)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
