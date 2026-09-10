import { Select } from '@/components/common/Select'
import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, FolderOpen, ArrowUp, ArrowDown, Files, Type, Palette, Link2, PanelBottom, ScanEye, FileOutput, FileCode2, Table2, BookOpen, ShieldCheck } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TopAppBar } from '@/components/layout/TopAppBar'
import { Button } from '@/components/common/Button'
import { useDocumentStore } from '@/stores/documentStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useConversionStore } from '@/stores/conversionStore'
import { FONTS, validateConversion, type ConversionSettings, type OutputFormat } from '@/types/conversion'
import { buildExportModel, collectDocuments, plainText, type ExportModel, type MissingDocumentLink } from '@/services/conversion/model'
import { LinkRepairs } from '@/components/converter/LinkRepairs'
import { standaloneHtml } from '@/services/conversion/html'
import { extractTables } from '@/services/conversion/xlsx'
import { downloadBinaryFile, downloadTextFile } from '@/utils/downloadFile'
import { DesignControls } from '@/components/converter/DesignControls'
import { PagedPreview, type PagePreviewResult } from '@/components/converter/PagedPreview'
import { hasFolderAccess } from '@/types/filesystem'
import styles from './ConverterPage.module.css'

const FORMATS: OutputFormat[] = ['pdf', 'docx', 'html', 'txt', 'xlsx']
export function ConverterPage() {
  const documents = useDocumentStore((state) => state.documents)
  const activeId = useDocumentStore((state) => state.activeId)
  const workspace = useWorkspaceStore((state) => state.workspace)
  const linkOverrides = useWorkspaceStore((state) => state.linkOverrides)
  const [missingLinks, setMissingLinks] = useState<MissingDocumentLink[]>([])
  const openFile = useWorkspaceStore((state) => state.openFile)
  const openFolder = useWorkspaceStore((state) => state.openFolder)
  const wsError = useWorkspaceStore((state) => state.error)
  const docError = useDocumentStore((state) => state.error)
  const { settings: s, update } = useConversionStore()
  const [panel, setPanel] = useState<'source' | 'design' | 'layout' | 'more'>('source')
  const [preview, setPreview] = useState<PagePreviewResult | null>(null)
  const [sourceId, setSourceId] = useState<string | null>(activeId)
  const currentId = sourceId && (documents.has(sourceId) || workspace?.filesById.has(sourceId)) ? sourceId : activeId
  const currentNode = documents.get(currentId ?? '')?.node ?? workspace?.filesById.get(currentId ?? '')
  const canChain = hasFolderAccess(workspace) && !currentNode?.standalone && !!workspace?.filesById.has(currentId ?? '')
  const sourceMode = s.sourceMode === 'linked-chain' && !canChain ? 'current' : s.sourceMode
  const [selected, setSelected] = useState<string[]>([])
  const modelInputs = useMemo(() => ({ workspace, documents, currentId, sourceMode, selected, links: s.internalMarkdownLinks, linkOverrides }), [workspace, documents, currentId, sourceMode, selected, s.internalMarkdownLinks, linkOverrides])
  const [prepared, setPrepared] = useState<{ inputs: typeof modelInputs; model: ExportModel } | null>(null)
  const model = prepared?.inputs === modelInputs ? prepared.model : null
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filename, setFilename] = useState('document')
  const [marginPreset, setMarginPreset] = useState('custom')
  const nodes = useMemo(() => {
    const map = new Map(workspace?.filesById ?? [])
    documents.forEach((doc) => map.set(doc.id, doc.node))
    return Array.from(map.values())
  }, [documents, workspace])
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true); setError(''); setPrepared(null)
      void collectDocuments(workspace, documents, currentId, sourceMode, selected, linkOverrides)
        .then((sources) => { if (!cancelled) setMissingLinks(sources.missingLinks); return buildExportModel(sources.documents, s, workspace, sources.warnings, linkOverrides) })
        .then((value) => { if (!cancelled) setPrepared({ inputs: modelInputs, model: value }) })
        .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Cannot prepare documents.') })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 180)
    return () => { cancelled = true; clearTimeout(timer) }
    // Typography changes only affect presentation, not the document model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelInputs])
  const invalid = ['txt', 'xlsx'].includes(s.format) ? null : validateConversion(s)
  const tables = useMemo(() => model ? extractTables(model) : [], [model])
  const html = useMemo(() => model && !invalid ? standaloneHtml(model, s) : '', [model, s, invalid])
  const txt = useMemo(() => model?.documents.map((doc) => plainText(doc.tree)).join('\n\n') ?? '', [model])
  const styled = ['pdf', 'docx', 'html'].includes(s.format)
  const disabledReason = invalid ?? (!model?.documents.length ? 'Choose a source document.' : s.format === 'xlsx' && !tables.length ? 'No tables detected in the selected documents.' : '')
  const set = <K extends keyof ConversionSettings>(key: K, value: ConversionSettings[K]) => update({ [key]: value })
  const reorder = (index: number, delta: number) => {
    const next = [...selected]; const other = index + delta
    if (other < 0 || other >= next.length) return
    ;[next[index], next[other]] = [next[other], next[index]]; setSelected(next)
  }
  const doExport = async () => {
    if (!model || disabledReason || loading) return
    setBusy(true); setError(''); setNotice('')
    const name = filename.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-') || 'document'
    try {
      if (s.format === 'pdf') { if (preview?.model !== model || preview?.settings !== s) return; preview.print(); setNotice('Choose Save as PDF, keep scale at 100%, and turn off browser headers and footers. Enable background graphics for page colours.') }
      else if (s.format === 'html') downloadTextFile(html, `${name}.html`, 'text/html;charset=utf-8')
      else if (s.format === 'txt') downloadTextFile(txt, `${name}.txt`, 'text/plain;charset=utf-8')
      else if (s.format === 'docx') { const { exportDocx } = await import('@/services/conversion/docx'); downloadBinaryFile(await exportDocx(model, s), `${name}.docx`) }
      else { const { exportXlsx } = await import('@/services/conversion/xlsx'); downloadBinaryFile(await exportXlsx(model), `${name}.xlsx`) }
      if (s.format !== 'pdf') setNotice(`${s.format.toUpperCase()} export downloaded.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Export failed.') }
    finally { setBusy(false) }
  }
  return <AppShell topBar={<TopAppBar />}><div className={styles.root}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>YOUR WORDS, READY TO SHARE</span><h1>Convert document</h1><p>1. Choose documents. 2. Pick a design. 3. Preview and export.</p></div><span className={styles.privacy}><ShieldCheck size={14} aria-hidden="true" />Processed in your browser</span></div>
    <div className={styles.layout}><aside className={styles.controls} aria-label="Conversion settings">
      <section className={styles.group}><h2><FileOutput aria-hidden="true" />Output</h2><div className={styles.formats} role="group" aria-label="Output format">{FORMATS.map((format) => <button type="button" key={format} data-format={format} aria-pressed={s.format === format} onClick={() => set('format', format)}>{format === 'xlsx' ? <Table2 aria-hidden="true" /> : format === 'html' ? <FileCode2 aria-hidden="true" /> : <FileText aria-hidden="true" />}{format.toUpperCase()}</button>)}</div><label>Export filename<input value={filename} onChange={(e) => setFilename(e.target.value)} /><small>Download name only; never inserted into document content.</small></label></section>
      <nav className={styles.settingTabs} aria-label="Converter settings">{(['source', 'design', 'layout', 'more'] as const).map((tab) => <button type="button" key={tab} aria-pressed={panel === tab} onClick={() => setPanel(tab)}>{tab === 'source' ? <Files /> : tab === 'design' ? <Palette /> : tab === 'layout' ? <BookOpen /> : <PanelBottom />}{tab === 'more' ? 'Options' : tab[0].toUpperCase() + tab.slice(1)}</button>)}</nav>
      <section hidden={panel !== 'source'} className={styles.group}><h2><Files aria-hidden="true" />Document</h2><label>Source<Select value={sourceMode} onChange={(e) => set('sourceMode', e.target.value as ConversionSettings['sourceMode'])}><option value="current">Current document</option><option value="linked-chain" disabled={!canChain}>Follow Next links (folder)</option><option value="selected">Selected documents, in chosen order</option><option value="workspace" disabled={!hasFolderAccess(workspace)}>Entire workspace</option></Select></label>
        {['current', 'linked-chain'].includes(sourceMode) && <label>Starting document<Select value={currentId ?? ''} onChange={(e) => setSourceId(e.target.value)}><option value="" disabled>Select document</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.path}</option>)}</Select></label>}
        {s.sourceMode === 'selected' && <div className={styles.selection}>{nodes.map((node) => <label className={styles.check} key={node.id}><input type="checkbox" checked={selected.includes(node.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, node.id] : selected.filter((id) => id !== node.id))} />{node.path}</label>)}<ol>{selected.map((id, index) => <li key={id}>{nodes.find((node) => node.id === id)?.path}<button type="button" aria-label={`Move document ${index + 1} up`} onClick={() => reorder(index, -1)} disabled={index === 0}><ArrowUp size={14} /></button><button type="button" aria-label={`Move document ${index + 1} down`} onClick={() => reorder(index, 1)} disabled={index === selected.length - 1}><ArrowDown size={14} /></button></li>)}</ol></div>}
        <div className={styles.row}><Button variant="tonal" size="sm" icon={<FileText />} onClick={() => void openFile().then(() => setSourceId(useDocumentStore.getState().activeId))}>Open file</Button><Button variant="tonal" size="sm" icon={<FolderOpen />} onClick={() => void openFolder().then(() => setSourceId(useDocumentStore.getState().activeId))}>Open folder</Button></div>
        {model && <details><summary>{model.documents.length} document{model.documents.length === 1 ? '' : 's'} in export order</summary><ol>{model.documents.map((doc) => <li key={doc.id}>{doc.path}</li>)}</ol></details>}
        {sourceMode === 'linked-chain' && <small>Follows Next/Continue links in document order. Previous links, unrelated references, and repeated documents are skipped.</small>}
      {!canChain && <small>Single files convert on their own. Open a folder to follow linked documents.</small>}
        {currentNode?.standalone && currentId && <Button variant="tonal" size="sm" onClick={() => void useWorkspaceStore.getState().attachAssetFolder(currentId)}>Connect image folder</Button>}
      </section>
      {styled && panel === 'design' && <DesignControls settings={s} update={update} />}
      {canChain && sourceMode === 'linked-chain' && <LinkRepairs missing={missingLinks} workspace={workspace} />}
      {styled && <section hidden={panel !== 'design'} className={styles.group}><h2><Type aria-hidden="true" />Typography</h2><label>Font family<Select value={s.fontFamily} onChange={(e) => set('fontFamily', e.target.value)}>{FONTS.map((font) => <option key={font}>{font}</option>)}</Select><small>20 professional font choices. Uses fonts installed on this device; unavailable fonts fall back locally.</small></label><div className={styles.row}><label>Font size (pt)<input type="number" min="8" max="48" value={s.bodyFontSize} onChange={(e) => set('bodyFontSize', e.target.valueAsNumber)} /></label><label>Line spacing<input type="number" min="1" max="3" step="0.05" value={s.lineHeight} onChange={(e) => set('lineHeight', e.target.valueAsNumber)} /></label></div><label>Paragraph alignment<Select value={s.alignment} onChange={(e) => set('alignment', e.target.value as ConversionSettings['alignment'])}><option value="left">Left</option><option value="justify">Justified</option></Select></label><div className={styles.row}><label>Table style<Select value={s.tableStyle} onChange={(e) => set('tableStyle', e.target.value as ConversionSettings['tableStyle'])}>{['simple', 'grid', 'minimal'].map((v) => <option key={v}>{v}</option>)}</Select></label><label>Code style<Select value={s.codeStyle} onChange={(e) => set('codeStyle', e.target.value as ConversionSettings['codeStyle'])}>{['light', 'dark', 'minimal'].map((v) => <option key={v}>{v}</option>)}</Select></label></div></section>}
      {styled && <section hidden={panel !== 'layout'} className={styles.group}><h2><BookOpen aria-hidden="true" />Page</h2><div className={styles.row}><label>Paper size<Select value={s.pageSize} onChange={(e) => set('pageSize', e.target.value as ConversionSettings['pageSize'])}>{['A4', 'A3', 'Letter', 'Legal'].map((v) => <option key={v}>{v}</option>)}</Select></label><label>Orientation<Select value={s.orientation} onChange={(e) => set('orientation', e.target.value as ConversionSettings['orientation'])}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></Select></label></div><label>Margins<Select value={marginPreset} onChange={(e) => { setMarginPreset(e.target.value); const n = { narrow: 12.7, normal: 20, wide: 30 }[e.target.value]; if (n) set('margins', { top: n, right: n, bottom: n, left: n }) }}><option value="narrow">Narrow</option><option value="normal">Normal</option><option value="wide">Wide</option><option value="custom">Custom</option></Select></label><div className={styles.marginGrid}>{(['top', 'right', 'bottom', 'left'] as const).map((side) => <label key={side}>{side} (mm)<input type="number" min="0" max="100" step="1" value={s.margins[side]} onChange={(e) => { setMarginPreset('custom'); set('margins', { ...s.margins, [side]: e.target.valueAsNumber }) }} /></label>)}</div><label>Columns<Select value={s.columns} onChange={(e) => set('columns', Number(e.target.value) as 1 | 2 | 3)}><option value={1}>One column</option><option value={2}>Two columns</option><option value={3}>Three columns</option></Select></label><label>Column gap (mm)<input type="number" min="3" max="25" value={s.columnGap} onChange={(e) => set('columnGap', e.target.valueAsNumber)} /></label><label>Document separation<Select value={s.linkedDocumentSeparation} onChange={(e) => set('linkedDocumentSeparation', e.target.value as ConversionSettings['linkedDocumentSeparation'])}><option value="continuous">Continuous</option><option value="new-page">New page for each document</option></Select></label></section>}
      <section hidden={panel !== 'more'} className={styles.group}><h2><Link2 aria-hidden="true" />Links</h2><label>Internal Markdown links<Select value={s.internalMarkdownLinks} onChange={(e) => set('internalMarkdownLinks', e.target.value as ConversionSettings['internalMarkdownLinks'])}><option value="hide-if-included">Hide navigation blocks and included MD links</option><option value="keep">Keep</option></Select></label><small>Previous/Next navigation sections are removed as a whole, including their headings. Website/email links and ordinary missing or excluded document references remain.</small></section>
      {styled && <section hidden={panel !== 'more'} className={styles.group}><h2><PanelBottom aria-hidden="true" />Header &amp; footer</h2><label className={styles.check}><input type="checkbox" checked={s.header.enabled} onChange={(e) => set('header', { ...s.header, enabled: e.target.checked })} />Enable header</label>{s.header.enabled && <label>Header text<input value={s.header.text} onChange={(e) => set('header', { ...s.header, text: e.target.value })} placeholder="Your own text" /></label>}<label className={styles.check}><input type="checkbox" checked={s.footer.enabled} onChange={(e) => set('footer', { ...s.footer, enabled: e.target.checked })} />Enable footer</label>{s.footer.enabled && <><label>Footer text<input value={s.footer.customText} onChange={(e) => set('footer', { ...s.footer, customText: e.target.value })} /></label><label className={styles.check}><input type="checkbox" checked={s.footer.pageNumbers} onChange={(e) => set('footer', { ...s.footer, pageNumbers: e.target.checked })} />Page numbers</label>{s.footer.pageNumbers && <label>Number format<Select value={s.footer.pageNumberFormat} onChange={(e) => set('footer', { ...s.footer, pageNumberFormat: e.target.value as ConversionSettings['footer']['pageNumberFormat'] })}><option value="number">1</option><option value="page">Page 1</option><option value="page-total">Page 1 of 10</option><option value="fraction">1 / 10</option></Select></label>}<label>Footer alignment<Select value={s.footer.alignment} onChange={(e) => set('footer', { ...s.footer, alignment: e.target.value as ConversionSettings['footer']['alignment'] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></Select></label></>}</section>}
      {(s.format === 'pdf' || s.format === 'html') && <section hidden={panel !== 'more'} className={styles.group}><h2><Palette aria-hidden="true" />Document styling</h2><label className={styles.check}><input type="checkbox" checked={s.documentCss} onChange={(e) => set('documentCss', e.target.checked)} />Apply safe document CSS</label><small>Preserve safe document decoration. Your chosen font sizes and colours take priority.</small></section>}
    </aside><section className={styles.preview} aria-label="Export preview"><div className={styles.previewHeading}><h2><ScanEye aria-hidden="true" />Export preview</h2><span>{s.format.toUpperCase()}</span></div>
      {s.format === 'pdf' && <p className={styles.previewNote}>Pages below are used for PDF printing. Keep print scale at 100%, turn off browser headers/footers, and enable background graphics for page colours.</p>}
      {s.format === 'docx' && <p className={styles.previewNote}>Layout preview using your Word settings. Page count is an estimate for DOCX: Word recalculates pagination with its fonts and layout engine. Document CSS decoration is not translated to Word.</p>}
      {s.format === 'html' && <p className={styles.previewNote}>Standalone HTML. Page numbers are calculated when printed in a compatible browser.</p>}
      {(error || wsError || docError) && <p className={styles.error} role="alert">{error || wsError || docError}</p>}
      {loading ? <div className={styles.empty} role="status">Preparing documents…</div> : disabledReason ? <div className={styles.empty}>{disabledReason}</div> : model && <>
        {['pdf', 'docx'].includes(s.format) ? <PagedPreview model={model} settings={s} onReady={setPreview} /> : s.format === 'txt' ? <pre className={styles.textPreview}>{txt}</pre> : s.format === 'xlsx' ? <div className={styles.sheets}>{tables.map((rows, i) => <section key={i}><h3>Table {i + 1}</h3><table><tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}</tbody></table></section>)}</div> : <iframe title="Export document preview" sandbox="" srcDoc={html} className={styles.previewFrame} />}
      </>}
      {!!model?.warnings.length && <details className={styles.warnings}><summary>{model.warnings.length} document warning{model.warnings.length === 1 ? '' : 's'}</summary><ul>{model.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
      <div className={styles.exportBar}><span role="status">{notice || (s.format === 'xlsx' ? 'One worksheet per table. Cell values are preserved as text.' : 'Source files remain unchanged.')}</span><Button variant="filled" icon={<Download />} disabled={!!disabledReason || loading || busy || (s.format === 'pdf' && (preview?.model !== model || preview?.settings !== s))} onClick={() => void doExport()}>{busy ? 'Exporting…' : s.format === 'pdf' ? 'Print / Save PDF' : `Export ${s.format.toUpperCase()}`}</Button></div>
    </section></div>
  </div></AppShell>
}
