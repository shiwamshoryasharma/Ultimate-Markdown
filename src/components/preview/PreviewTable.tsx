import { useRef, useState, type ComponentPropsWithoutRef } from 'react'
import type { ExtraProps } from 'react-markdown'
import { Check, Copy, Download, Table2 } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import './PreviewTable.css'

export function PreviewTable({ node: _node, children, className, ...props }: ComponentPropsWithoutRef<'table'> & ExtraProps) {
  const table = useRef<HTMLTableElement>(null)
  const density = useSettingsStore(state => state.preview.tableDensity)
  const [notice, setNotice] = useState('')
  const rows = () => Array.from(table.current?.rows ?? []).map(row => Array.from(row.cells).map(cell => cell.innerText.trim()))
  const copy = async () => {
    try { await navigator.clipboard.writeText(rows().map(row => row.join('\t')).join('\n')); setNotice('Table copied') }
    catch { setNotice('Copy unavailable. Use Download CSV.') }
  }
  const download = () => {
    const csv = rows().map(row => row.map(cell => '"' + (/^[\s]*[=+@-]/.test(cell) ? "'" + cell : cell).replaceAll('"', '""') + '"').join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'table.csv'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="um-table" data-density={density}>
    <div className="um-table__bar"><span><Table2 size={16} aria-hidden="true" />Table</span><div><button type="button" onClick={() => void copy()} aria-label="Copy table">{notice === 'Table copied' ? <Check size={15} /> : <Copy size={15} />}Copy</button><button type="button" onClick={download} aria-label="Download table as CSV"><Download size={15} />CSV</button></div></div>
    <div className="um-table__scroll" tabIndex={0} role="region" aria-label="Scrollable table"><table {...props} ref={table} className={className}>{children}</table></div>
    {notice && <span className="um-table__notice" role="status">{notice}</span>}
  </div>
}
