import { AppShell } from '@/components/layout/AppShell'
import { TopAppBar } from '@/components/layout/TopAppBar'
import { ImportSource } from '@/components/import/ImportSource'
import { ImportReview } from '@/components/import/ImportReview'
import { useImportStore } from '@/stores/importStore'
import styles from '@/components/import/Import.module.css'

export function ImportPage() {
  const session=useImportStore(s=>s.session)
  return <AppShell topBar={<TopAppBar/>}><main className={styles.page}><div className={styles.container}>{!session&&<header className={styles.heading}><span className={styles.eyebrow}>IMPORT & CONVERT</span><h1>Import to Markdown</h1><p>Turn a webpage or document into clean Markdown. Preview, copy or download in one place.</p></header>}{session?<details className={styles.newImport}><summary>Import another source</summary><ImportSource/></details>:<ImportSource/>}{session&&<ImportReview key={session.id}/>}</div></main></AppShell>
}
