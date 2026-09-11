import { useEffect, useMemo, useState } from 'react'
import { useImportActions } from '@/hooks/useImportActions'
import type { ImportSession } from '@/types/import'
import type { OutputFormat } from '@/types/conversion'
import { validateConversion } from '@/types/conversion'
import { buildExportModel, type ExportModel } from '@/services/conversion/model'
import { importedSources } from '@/services/import/serialize'
import { standaloneHtml } from '@/services/conversion/html'
import { PagedPreview, type PagePreviewResult } from '@/components/converter/PagedPreview'
import { DesignControls } from '@/components/converter/DesignControls'
import { Select } from '@/components/common/Select'
import { useConversionStore } from '@/stores/conversionStore'
import { useImportStore } from '@/stores/importStore'
import styles from './Import.module.css'

export function ImportOutput({session}:{session:ImportSession}) {
  const {settings,update}=useConversionStore(), review=useImportStore(s=>s.review)
  const [prepared,setPrepared]=useState<{documents:ImportSession['documents'];settings:typeof settings;model:ExportModel}|null>(null),[error,setError]=useState('')
  const {openMarkdown,error:actionError}=useImportActions(session)
  const [preview,setPreview]=useState<PagePreviewResult|null>(null)
  const sources=useMemo(()=>importedSources(session.documents),[session.documents])
  const model=prepared?.documents===session.documents&&prepared?.settings===settings?prepared.model:null
  const invalid=validateConversion(settings)
  useEffect(()=>{
    let cancelled=false
    const timer=setTimeout(()=>{void buildExportModel(sources,settings,null).then(value=>{if(!cancelled){setPrepared({documents:session.documents,settings,model:value});setError('')}}).catch(e=>{if(!cancelled)setError(String(e))})},180)
    return ()=>{cancelled=true;clearTimeout(timer)}
  },[sources,session.documents,settings])
  const previewReady=!!model && (!['pdf','docx'].includes(settings.format) || preview?.model===model&&preview?.settings===settings)
  const ready=session.reviewedRevision===session.revision && previewReady && !invalid && sources.some(s=>s.content.trim())
  return <section className={styles.output} aria-label="Import output preview">
    <div className={styles.outputControls}><label>Preview format<Select aria-label="Import preview format" value={['pdf','docx','html'].includes(settings.format)?settings.format:'html'} onChange={e=>update({format:e.target.value as OutputFormat})}><option value="pdf">PDF</option><option value="docx">DOCX</option><option value="html">HTML</option></Select></label><p>{settings.fontFamily} · {settings.pageSize} · {settings.orientation} · {settings.columns} column(s)</p></div>
    <details><summary>Document design</summary><DesignControls settings={settings} update={update}/></details>
    <p className={styles.note}>Final preview uses your existing export settings. DOCX pagination is an estimate. Open Converter after review for all fonts, margins, page numbering and output formats.</p>
    {(error||actionError)&&<p role="alert">{error||actionError}</p>}{invalid&&<p role="alert">{invalid}</p>}
    {!sources.some(s=>s.content.trim())?<p role="status">All blocks are excluded. Keep at least one block before exporting.</p>:model&&!invalid?<div className={styles.outputFrame}>{['pdf','docx'].includes(settings.format)?<PagedPreview model={model} settings={settings} onReady={setPreview}/>:<iframe title="Imported output preview" sandbox="" srcDoc={standaloneHtml(model,settings)}/>}</div>:<p role="status">Preparing final preview…</p>}
    {!!model?.warnings.length&&<details><summary>Export warnings ({model.warnings.length})</summary><ul>{model.warnings.map(w=><li key={w}>{w}</li>)}</ul></details>}
    <div className={styles.actions}><button type="button" disabled={!previewReady||!!invalid||!sources.some(s=>s.content.trim())} onClick={review}>{session.reviewedRevision===session.revision?'Review confirmed':'Confirm review'}</button><button type="button" disabled={!ready} onClick={()=>openMarkdown('/converter')}>Open Converter</button></div>
  </section>
}
