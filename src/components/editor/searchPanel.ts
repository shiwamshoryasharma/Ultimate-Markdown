import { type EditorView, type Panel, type ViewUpdate, runScopeHandlers } from '@codemirror/view'
import { closeSearchPanel, findNext, findPrevious, getSearchQuery, openSearchPanel, replaceAll, replaceNext, SearchQuery, setSearchQuery } from '@codemirror/search'
import './searchPanel.css'

export function openReplacePanel(view: EditorView): boolean {
  openSearchPanel(view)
  view.dom.querySelector('.um-find')?.dispatchEvent(new Event('um-open-replace'))
  return true
}

export function createSearchPanel(view: EditorView): Panel {
  const dom = document.createElement('div')
  dom.className = 'um-find'
  dom.setAttribute('role', 'search')
  dom.setAttribute('aria-label', 'Find and replace')
  const row = document.createElement('div'); row.className = 'um-find-row'
  const replaceRow = document.createElement('div'); replaceRow.className = 'um-replace-row'; replaceRow.hidden = true
  const field = (name: string, placeholder: string) => {
    const input = document.createElement('input'); input.name = name; input.placeholder = placeholder; input.setAttribute('aria-label', placeholder); input.autocomplete = 'off'; input.spellcheck = false
    return input
  }
  const find = field('search', 'Find')
  find.setAttribute('main-field', 'true')
  const replace = field('replace', 'Replace')
  const button = (label: string, text: string, action: () => void) => {
    const el = document.createElement('button'); el.type = 'button'; el.title = label; el.setAttribute('aria-label', label); el.textContent = text; el.onclick = action; return el
  }
  const expand = button('Toggle replace', '›', () => showReplace(!!replaceRow.hidden))
  expand.setAttribute('aria-expanded', 'false')
  const showReplace = (show: boolean) => {
    if (view.state.readOnly) return
    replaceRow.hidden = !show; expand.textContent = show ? '⌄' : '›'; expand.setAttribute('aria-expanded', String(show))
  }
  dom.addEventListener('um-open-replace', () => { showReplace(true); replace.focus() })
  const count = document.createElement('span'); count.className = 'um-find-count'; count.setAttribute('role', 'status')
  const toggles = document.createElement('span'); toggles.className = 'um-find-options'
  let query = getSearchQuery(view.state)
  const options = ([['caseSensitive', 'Match case', 'Aa'], ['wholeWord', 'Match whole word', 'Ab'], ['regexp', 'Use regular expression', '.*']] as const).map(([key, label, symbol]) => {
    const el = button(label, symbol, () => {
      query = new SearchQuery({ ...query, [key]: !query[key] })
      commit(query)
    })
    toggles.append(el)
    return { el, key }
  })
  const inputBox = document.createElement('div'); inputBox.className = 'um-find-input'; inputBox.append(find, toggles)
  row.append(expand, inputBox, count, button('Previous match (Shift+Enter)', '↑', () => findPrevious(view)), button('Next match (Enter)', '↓', () => findNext(view)), button('Close find (Escape)', '×', () => closeSearchPanel(view)))
  replaceRow.append(replace, button('Replace next', 'Replace', () => replaceNext(view)), button('Replace all', 'All', () => replaceAll(view)))
  dom.append(row, replaceRow)
  let matches: { from: number; to: number }[] = []
  let truncated = false
  function refresh(recount: boolean) {
    find.value = query.search; replace.value = query.replace
    for (const { el, key } of options) el.setAttribute('aria-pressed', String(query[key]))
    find.setAttribute('aria-invalid', String(!!query.search && !query.valid))
    if (recount) {
      matches = []; truncated = false
      if (query.valid) {
        const cursor = query.getCursor(view.state)
        for (let next = cursor.next(); !next.done; next = cursor.next()) {
          if (matches.length >= 10000) { truncated = true; break }
          matches.push(next.value)
        }
      }
    }
    const selected = view.state.selection.main
    const index = matches.findIndex((match) => match.from === selected.from && match.to === selected.to)
    count.textContent = !query.search ? '' : !query.valid ? 'Invalid regex' : !matches.length ? 'No results' : `${index < 0 ? '–' : index + 1} of ${matches.length}${truncated ? '+' : ''}`
  }
  function commit(next: SearchQuery) {
    query = next
    view.dispatch({ effects: setSearchQuery.of(query) })
  }
  find.oninput = () => commit(new SearchQuery({ ...query, search: find.value }))
  replace.oninput = () => commit(new SearchQuery({ ...query, replace: replace.value }))
  dom.onkeydown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); if (event.target === replace) replaceNext(view); else (event.shiftKey ? findPrevious : findNext)(view) }
    else if (runScopeHandlers(view, event, 'search-panel')) event.preventDefault()
  }
  refresh(true)
  return { dom, top: true, mount: () => { find.focus(); find.select() }, update: (update: ViewUpdate) => {
    const next = getSearchQuery(update.state)
    const changed = !next.eq(query) || update.transactions.some((tr) => tr.effects.some((effect) => effect.is(setSearchQuery)))
    query = next; refresh(changed || update.docChanged)
  } }
}
