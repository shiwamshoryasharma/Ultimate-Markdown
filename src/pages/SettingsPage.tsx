import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, Code2, Columns2, Eye, FileOutput, Image, Keyboard, Laptop, Moon, Palette, RotateCcw, SlidersHorizontal, Sparkles, Sun, Table2, Type, Volume2, WandSparkles } from 'lucide-react'
import { Select } from '@/components/common/Select'
import { AppShell } from '@/components/layout/AppShell'
import { TopAppBar } from '@/components/layout/TopAppBar'
import { MarkdownPreview } from '@/components/preview/MarkdownPreview'
import { useSettingsStore } from '@/stores/settingsStore'
import { useConversionStore } from '@/stores/conversionStore'
import { DEFAULT_SETTINGS, type ThemeMode } from '@/types/settings'
import { PAGE_SIZES } from '@/types/conversion'
import styles from './SettingsPage.module.css'

const sections = [
  { id: 'appearance', title: 'Appearance', detail: 'Theme & motion', icon: Palette, color: 'violet' },
  { id: 'editor', title: 'Editor', detail: 'Your writing space', icon: Code2, color: 'blue' },
  { id: 'reading', title: 'Reading', detail: 'Type & tables', icon: BookOpen, color: 'teal' },
  { id: 'media', title: 'Media', detail: 'Images & video', icon: Image, color: 'rose' },
  { id: 'export', title: 'Export', detail: 'Page defaults', icon: FileOutput, color: 'amber' },
] as const
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className={styles.field}><div><strong>{label}</strong>{hint && <small>{hint}</small>}</div>{children}</div>
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <button className={styles.toggle} type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)}><span /></button>
}
function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <input aria-label={label} type="number" className={styles.number} min={min} max={max} step={step} value={value} onChange={event => { const next = event.target.valueAsNumber; if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next))) }} />
}
const sample = '### A space for your ideas\nClear typography makes every document easier to read. **Make it yours.**\n\n| Feature | Status |\n| :--- | :--- |\n| Live preview | Ready |\n| Modern tables | Ready |'
export function SettingsPage() {
  const [active, setActive] = useState<(typeof sections)[number]['id']>('appearance')
  const { theme, editor, preview, setTheme, updateEditorSettings: edit, updatePreviewSettings: read } = useSettingsStore()
  const { settings: output, update: exportUpdate } = useConversionStore()
  const selected = sections.find(section => section.id === active)!
  const Icon = selected.icon
  const reset = () => {
    if (active === 'appearance') { setTheme('system'); read({ reducedMotion: false }) }
    if (active === 'editor') edit(DEFAULT_SETTINGS.editor)
    if (active === 'reading') read({ fontSize: 16, contentWidth: 'comfortable', showToc: true, tableDensity: 'comfortable' })
    if (active === 'media') read({ imageCaptions: true })
    if (active === 'export') exportUpdate({ pageSize: 'A4', margins: { top: 20, right: 20, bottom: 20, left: 20 }, footer: { ...output.footer, enabled: false, pageNumbers: true } })
  }
  return <AppShell topBar={<TopAppBar />}><div className={styles.root}><div className={styles.container}>
    <header className={styles.header}><div><span className={styles.eyebrow}><SlidersHorizontal size={14} />YOUR WORKSPACE, YOUR WAY</span><h1>Make yourself at home.</h1><p>A few thoughtful adjustments. A better place to read and write.</p></div><span className={styles.saved}><Check size={15} />Saved on this device</span></header>
    <nav className={styles.cards} aria-label="Settings categories">{sections.map(({ id, title, detail, icon: CardIcon, color }) => <button type="button" key={id} className={styles.category} data-color={color} aria-pressed={active === id} onClick={() => setActive(id)}><span className={styles.icon}><CardIcon size={22} /></span><span><strong>{title}</strong><small>{detail}</small></span></button>)}</nav>
    <div className={styles.layout}>
      <section className={styles.panel} aria-label={selected.title + ' settings'}><header className={styles.panelHeader}><span className={styles.icon} data-color={selected.color}><Icon size={21} /></span><div><h2>{selected.title}</h2><p>{selected.detail}</p></div><button type="button" className={styles.reset} onClick={reset} title="Reset this section"><RotateCcw size={15} />Reset</button></header>
      {active === 'appearance' && <><div className={styles.themes}>{([{ mode: 'light', label: 'Daylight', icon: Sun }, { mode: 'dark', label: 'Midnight', icon: Moon }, { mode: 'system', label: 'System', icon: Laptop }] as const).map(({mode,label,icon:ThemeIcon}) => <button type="button" key={mode} className={styles.theme} data-mode={mode} aria-pressed={theme === mode} onClick={() => setTheme(mode as ThemeMode)}><span className={styles.themeWindow}><i /><i /><i /></span><span><ThemeIcon size={15} />{label}{theme === mode && <Check size={14} />}</span></button>)}</div><Field label="Reduce motion" hint="Calmer transitions and instant document jumps."><Toggle label="Reduce motion" checked={preview.reducedMotion} onChange={value => read({ reducedMotion: value })} /></Field><div className={styles.tip}><Sparkles size={20} /><p>The theme follows you through menus, navigation cards, tables, and media controls.</p></div></>}
      {active === 'editor' && <div className={styles.fields}>
        <Field label="Font size" hint="Pixels in the source editor"><NumberField label="Editor font size" value={editor.fontSize} min={11} max={28} onChange={value => edit({ fontSize: value })} /></Field>
        <Field label="Line spacing"><NumberField label="Editor line height" value={editor.lineHeight} min={1.2} max={2.2} step={0.1} onChange={value => edit({ lineHeight: value })} /></Field>
        <Field label="Tab width" hint="Spaces per indent"><NumberField label="Tab width" value={editor.tabSize} min={2} max={8} onChange={value => edit({ tabSize: value })} /></Field>
        <Field label="Wrap long lines"><Toggle label="Word wrap" checked={editor.wordWrap} onChange={value => edit({ wordWrap: value })} /></Field>
        <Field label="Line numbers"><Toggle label="Show line numbers" checked={editor.showLineNumbers} onChange={value => edit({ showLineNumbers: value })} /></Field>
        <div className={styles.tip}><Keyboard size={20} /><p><kbd>Ctrl F</kbd> Find · <kbd>Ctrl H</kbd> Replace</p></div>
      </div>}
      {active === 'reading' && <><div className={styles.presets}><button type="button" onClick={() => read({ fontSize: 18, contentWidth: 'narrow', tableDensity: 'comfortable' })}><BookOpen size={16} />Comfort reading</button><button type="button" onClick={() => read({ fontSize: 14, contentWidth: 'wide', tableDensity: 'compact' })}><Columns2 size={16} />Dense documents</button></div><div className={styles.fields}>
        <Field label="Text size"><NumberField label="Reading font size" value={preview.fontSize} min={12} max={28} onChange={value => read({ fontSize: value })} /></Field>
        <Field label="Content width"><Select aria-label="Content width" value={preview.contentWidth} onChange={event => read({ contentWidth: event.target.value as typeof preview.contentWidth })}>{['narrow','comfortable','wide','full'].map(value => <option key={value} value={value}>{value === 'full' ? 'Full width' : value[0].toUpperCase() + value.slice(1)}</option>)}</Select></Field>
        <Field label="Table density"><Select aria-label="Table density" value={preview.tableDensity} onChange={event => read({ tableDensity: event.target.value as typeof preview.tableDensity })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></Select></Field>
        <Field label="Table of contents" hint="Show the heading outline"><Toggle label="Show table of contents" checked={preview.showToc} onChange={value => read({ showToc: value })} /></Field>
      </div></>}
      {active === 'media' && <><Field label="Image captions" hint="Display the image’s Markdown description underneath."><Toggle label="Image captions" checked={preview.imageCaptions} onChange={value => read({ imageCaptions: value })} /></Field><div className={styles.feature}><Image size={22} /><div><strong>Get closer to the details</strong><p>Click an image to expand it, zoom up to 300%, or download it. Press Escape to return.</p></div></div><div className={styles.feature}><Volume2 size={22} /><div><strong>Video, at your pace</strong><p>Play, seek, mute, adjust volume, change speed, or go fullscreen. Playback starts when you choose.</p></div></div><div className={styles.tip}><Eye size={20} /><p>Open the source folder to make local images and videos available.</p></div></>}
      {active === 'export' && <><div className={styles.fields}><Field label="Paper size"><Select aria-label="Default paper size" value={output.pageSize} onChange={event => exportUpdate({ pageSize: event.target.value as typeof output.pageSize })}>{Object.keys(PAGE_SIZES).map(size => <option value={size} key={size}>{size}</option>)}</Select></Field><Field label="Margins" hint="Millimetres on all four sides"><NumberField label="Default margins" value={output.margins.top} min={0} max={50} onChange={value => exportUpdate({ margins: { top: value, right: value, bottom: value, left: value } })} /></Field><Field label="Page numbers" hint="Enable a numbered footer"><Toggle label="Export page numbers" checked={output.footer.enabled && output.footer.pageNumbers} onChange={value => exportUpdate({ footer: { ...output.footer, enabled: value, pageNumbers: value } })} /></Field></div><Link className={styles.converter} to="/converter"><WandSparkles size={18} />Open Converter for fonts, colours & layout</Link></>}
      </section>
      <aside className={styles.preview}><div className={styles.previewTitle}><Eye size={17} /><strong>Live reading preview</strong><span>LIVE</span></div><MarkdownPreview content={sample} documentPath="settings-preview.md" workspace={null} fontSize={preview.fontSize} contentWidth={preview.contentWidth} /><div className={styles.previewFooter}><Type size={14} />{preview.fontSize}px<Table2 size={14} />{preview.tableDensity} tables</div></aside>
    </div>
    <footer className={styles.footer}><Check size={14} />Preferences save automatically in this browser. Your source files stay yours.</footer>
  </div></div></AppShell>
}
