import { useEffect, useState, useSyncExternalStore } from 'react'
import { authorizeExtension, checkExtension, getExtensionStatus, revokeExtension, subscribeExtension } from '@/services/import/extension'
import styles from './Import.module.css'

export function ExtensionAccess() {
  const { installed, approved, checking } = useSyncExternalStore(subscribeExtension, getExtensionStatus)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { void checkExtension() }, [])
  const change = async () => {
    setBusy(true); setError('')
    try { if (approved) await revokeExtension(); else await authorizeExtension() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not connect the extension.') }
    finally { setBusy(false) }
  }
  return <aside className={styles.extensionAccess} aria-label="URL import connection">
    <div><strong>{approved ? 'URL imports enabled for this visit' : 'Import URLs with the companion extension'}</strong>
      <p>{approved ? 'You can import other public URLs without another prompt. Refreshing or leaving the app ends this session.' : 'Install once in Chrome or Edge, then approve each app visit. Downloads and conversion stay in your browser.'}</p></div>
    <div className={styles.extensionActions}>
      <button type="button" disabled={busy || checking} onClick={() => void change()}>{busy ? 'Waiting for extension…' : approved ? 'End URL session' : 'Enable URL imports'}</button>
      <a href={`${import.meta.env.BASE_URL}ultimate-markdown-extension.zip`} download>Download extension</a>
    </div>
    {!installed && !checking && <details open><summary>Install the extension</summary><ol>
      <li>Download the extension ZIP and extract it to a folder you will keep.</li>
      <li>Open <code>chrome://extensions</code> or <code>edge://extensions</code>, turn on Developer mode, then choose <strong>Load unpacked</strong> and select the extracted folder containing <code>manifest.json</code>.</li>
      <li>Save any unsaved work, reload this app, and paste a URL. Select <strong>Allow for this visit</strong> in the extension window.</li>
    </ol><p>The extension is currently distributed as an unpacked package. Local HTML and Word imports work without installing it.</p></details>}
    {error && <p role="alert">{error}</p>}
  </aside>
}
