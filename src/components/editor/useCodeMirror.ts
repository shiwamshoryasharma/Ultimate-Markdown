import { useEffect, useRef } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { highlightSelectionMatches, searchKeymap, search } from '@codemirror/search'
import { createSearchPanel, openReplacePanel } from './searchPanel'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import type { EditorSettings } from '@/types/settings'
import { umEditorTheme, umMarkdownHighlighting } from './editorTheme'

interface UseCodeMirrorOptions {
  initialValue: string
  onChange: (value: string) => void
  settings: EditorSettings
  onViewReady?: (view: EditorView | null) => void
}

/**
 * Creates one CodeMirror EditorView for the lifetime of the mounted component.
 * Callers remount (via a `key`) when switching documents rather than pushing
 * new content through this hook — simpler and avoids fighting the editor's
 * own change events to tell "external replace" apart from "user typed".
 */
export function useCodeMirror({ initialValue, onChange, settings, onViewReady }: UseCodeMirrorOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onViewReadyRef = useRef(onViewReady)
  onViewReadyRef.current = onViewReady

  const lineNumbersCompartment = useRef(new Compartment()).current
  const wrapCompartment = useRef(new Compartment()).current
  const tabSizeCompartment = useRef(new Compartment()).current
  const fontCompartment = useRef(new Compartment()).current

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        lineNumbersCompartment.of(settings.showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        search({ top: true, createPanel: createSearchPanel }),
        foldGutter(),
        markdown({ base: markdownLanguage, addKeymap: true }),
        umMarkdownHighlighting,
        umEditorTheme,
        wrapCompartment.of(settings.wordWrap ? EditorView.lineWrapping : []),
        tabSizeCompartment.of(indentUnit.of(' '.repeat(settings.tabSize))),
        fontCompartment.of(
          EditorView.theme({
            '&': {
              '--cm-font-size': `${settings.fontSize}px`,
              '--cm-line-height': String(settings.lineHeight),
            },
          }),
        ),
        keymap.of([{ key: 'Mod-h', run: openReplacePanel, scope: 'editor search-panel', preventDefault: true }, ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view
    onViewReadyRef.current?.(view)

    return () => {
      onViewReadyRef.current?.(null)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: [
        lineNumbersCompartment.reconfigure(settings.showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []),
        wrapCompartment.reconfigure(settings.wordWrap ? EditorView.lineWrapping : []),
        tabSizeCompartment.reconfigure(indentUnit.of(' '.repeat(settings.tabSize))),
        fontCompartment.reconfigure(
          EditorView.theme({
            '&': {
              '--cm-font-size': `${settings.fontSize}px`,
              '--cm-line-height': String(settings.lineHeight),
            },
          }),
        ),
      ],
    })
  }, [
    settings.showLineNumbers,
    settings.wordWrap,
    settings.tabSize,
    settings.fontSize,
    settings.lineHeight,
    lineNumbersCompartment,
    wrapCompartment,
    tabSizeCompartment,
    fontCompartment,
  ])

  return { containerRef, viewRef }
}
