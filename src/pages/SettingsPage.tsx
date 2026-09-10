import { Select } from '@/components/common/Select'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { TopAppBar } from '@/components/layout/TopAppBar'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/common/Button'
import { useSettingsStore } from '@/stores/settingsStore'
import styles from './SettingsPage.module.css'

function Field({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <div className={styles.fieldText}>
        <span className={styles.fieldLabel}>{label}</span>
        {description && <span className={styles.fieldDescription}>{description}</span>}
      </div>
      <div className={styles.fieldControl}>{children}</div>
    </label>
  )
}

export function SettingsPage() {
  const editor = useSettingsStore((state) => state.editor)
  const preview = useSettingsStore((state) => state.preview)
  const exportSettings = useSettingsStore((state) => state.export)
  const updateEditorSettings = useSettingsStore((state) => state.updateEditorSettings)
  const updatePreviewSettings = useSettingsStore((state) => state.updatePreviewSettings)
  const updateExportSettings = useSettingsStore((state) => state.updateExportSettings)
  const resetSettings = useSettingsStore((state) => state.resetSettings)

  return (
    <AppShell topBar={<TopAppBar />}>
      <div className={styles.root}>
        <div className={styles.scroll}>
          <h1 className={styles.pageTitle}>Settings</h1>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Appearance</h2>
            <Field label="Theme" description="Follows your system by default">
              <ThemeToggle />
            </Field>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Editor</h2>
            <Field label="Font size">
              <input
                type="number"
                min={11}
                max={28}
                value={editor.fontSize}
                onChange={(event) => updateEditorSettings({ fontSize: Number(event.target.value) })}
                className={styles.numberInput}
              />
            </Field>
            <Field label="Line height">
              <input
                type="number"
                min={1.2}
                max={2.2}
                step={0.1}
                value={editor.lineHeight}
                onChange={(event) => updateEditorSettings({ lineHeight: Number(event.target.value) })}
                className={styles.numberInput}
              />
            </Field>
            <Field label="Tab size">
              <input
                type="number"
                min={2}
                max={8}
                value={editor.tabSize}
                onChange={(event) => updateEditorSettings({ tabSize: Number(event.target.value) })}
                className={styles.numberInput}
              />
            </Field>
            <Field label="Word wrap">
              <input
                type="checkbox"
                checked={editor.wordWrap}
                onChange={(event) => updateEditorSettings({ wordWrap: event.target.checked })}
                className={styles.checkbox}
              />
            </Field>
            <Field label="Show line numbers">
              <input
                type="checkbox"
                checked={editor.showLineNumbers}
                onChange={(event) => updateEditorSettings({ showLineNumbers: event.target.checked })}
                className={styles.checkbox}
              />
            </Field>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Preview</h2>
            <Field label="Font size">
              <input
                type="number"
                min={12}
                max={28}
                value={preview.fontSize}
                onChange={(event) => updatePreviewSettings({ fontSize: Number(event.target.value) })}
                className={styles.numberInput}
              />
            </Field>
            <Field label="Content width">
              <Select
                value={preview.contentWidth}
                onChange={(event) => updatePreviewSettings({ contentWidth: event.target.value as typeof preview.contentWidth })}
                className={styles.select}
              >
                <option value="narrow">Narrow</option>
                <option value="comfortable">Comfortable</option>
                <option value="wide">Wide</option>
                <option value="full">Full width</option>
              </Select>
            </Field>
            <Field label="Show table of contents by default">
              <input
                type="checkbox"
                checked={preview.showToc}
                onChange={(event) => updatePreviewSettings({ showToc: event.target.checked })}
                className={styles.checkbox}
              />
            </Field>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Export</h2>
            <Field label="Paper size">
              <Select
                value={exportSettings.paperSize}
                onChange={(event) => updateExportSettings({ paperSize: event.target.value as typeof exportSettings.paperSize })}
                className={styles.select}
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
              </Select>
            </Field>
            <Field label="Margins (mm)">
              <input
                type="number"
                min={0}
                max={50}
                value={exportSettings.marginMm}
                onChange={(event) => updateExportSettings({ marginMm: Number(event.target.value) })}
                className={styles.numberInput}
              />
            </Field>
            <Field label="Show page numbers">
              <input
                type="checkbox"
                checked={exportSettings.showPageNumbers}
                onChange={(event) => updateExportSettings({ showPageNumbers: event.target.checked })}
                className={styles.checkbox}
              />
            </Field>
          </section>

          <div className={styles.footer}>
            <Button variant="outline" onClick={resetSettings}>
              Reset to defaults
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
