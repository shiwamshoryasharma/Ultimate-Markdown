import { Palette, Type, PaintBucket, Heading, LayoutTemplate } from 'lucide-react'
import { DOCUMENT_THEMES, DOCUMENT_STYLES, type ConversionSettings } from '@/types/conversion'
import styles from './DesignControls.module.css'

export function DesignControls({ settings: s, update }: { settings: ConversionSettings; update: (patch: Partial<ConversionSettings>) => void }) {
  return <div className={styles.root}>
    <section className={styles.group}><h2><Palette />Document theme</h2><p>Start with a colour palette, then make it yours.</p>
      <div className={styles.themes}>{DOCUMENT_THEMES.map((theme) => <button type="button" key={theme.id} aria-pressed={s.theme === theme.id} aria-label={`${theme.name} theme`} onClick={() => update({ theme: theme.id, pageColor: theme.pageColor, textColor: theme.textColor, headingColor: theme.headingColor, linkColor: theme.linkColor, fontFamily: theme.fontFamily })}>
        <span className={styles.paper} style={{ background: theme.pageColor, color: theme.headingColor, fontFamily: theme.fontFamily }}><b>Aa</b><i /><i /><span>{[theme.headingColor, theme.linkColor, theme.textColor].map((color, index) => <em key={index} style={{ background: color }} />)}</span></span><strong>{theme.name}</strong>
      </button>)}</div>
    </section>
    <section className={styles.group}><h2><PaintBucket />Page &amp; font colours</h2><div className={styles.colours}>{([['pageColor', 'Page colour'], ['textColor', 'Body colour'], ['headingColor', 'Heading colour'], ['linkColor', 'Link colour']] as const).map(([key, label]) => <label key={key}><input type="color" aria-label={label} value={s[key]} onChange={(e) => update({ [key]: e.target.value, theme: 'custom' })} /><span>{label}<small>{s[key].toUpperCase()}</small></span></label>)}</div></section>
    <section className={styles.group}><h2><LayoutTemplate />Document style</h2><div className={styles.presets}>{Object.entries(DOCUMENT_STYLES).map(([key, { name, ...preset }]) => <button type="button" key={key} onClick={() => update(preset)}>{name}</button>)}</div><p>Styles set type sizes, spacing, and columns. Adjust any value below.</p></section>
    <section className={styles.group}><h2><Heading />Heading sizes</h2><div className={styles.sizes}>{s.headingSizes.map((value, index) => <label key={index}>Heading {index + 1} (pt)<input type="number" min={8} max={72} value={value} onChange={(e) => { const headingSizes = [...s.headingSizes] as ConversionSettings['headingSizes']; headingSizes[index] = e.target.valueAsNumber; update({ headingSizes }) }} /></label>)}</div></section>
    <section className={styles.group}><h2><Type />Detail &amp; spacing</h2><div className={styles.sizes}><label>Code size (pt)<input type="number" min={6} max={48} value={s.codeFontSize} onChange={(e) => update({ codeFontSize: e.target.valueAsNumber })} /></label><label>Paragraph gap (pt)<input type="number" min={0} max={48} value={s.paragraphSpacing} onChange={(e) => update({ paragraphSpacing: e.target.valueAsNumber })} /></label></div></section>
  </div>
}
