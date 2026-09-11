import { useState } from 'react'
import { useConfirmation } from '@/hooks/useConfirmation'
import { Select } from '@/components/common/Select'
import { useImportStore } from '@/stores/importStore'
import { importDocx } from '@/services/import/docx'
import type { DocxMapping } from '@/types/import'
import styles from './Import.module.css'

export function DocxStyleMappings() {
  const confirm=useConfirmation()
  const {docxFile,mappings,docxStyles,docxImages,setDocx,setDocuments}=useImportStore()
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[additional,setAdditional]=useState('')
  if(!docxFile) return null
  const apply=async()=>{
    if(!await confirm({title:'Replace block edits?',description:'Reparsing the original Word document with these mappings will replace your current block edits.',confirmLabel:'Reparse document'})) return
    setBusy(true);setError('')
    try {const {doc,styles:found}=await importDocx(docxFile,mappings,docxImages);setDocuments([doc]);setDocx(docxFile,mappings,found)} catch(e) {setError(e instanceof Error?e.message:'Could not map DOCX styles.')} finally {setBusy(false)}
  }
  return <details className={styles.mapping}><summary>DOCX style mapping</summary><p>Changes apply to the original Word structure when you choose Reparse. Existing review edits will be replaced.</p><div className={styles.mappingGrid}>{mappings.map((mapping,i)=><label key={mapping.style}>{mapping.style}<Select aria-label={`Map ${mapping.style}`} value={mapping.target} onChange={e=>setDocx(docxFile,mappings.map((m,n)=>n===i?{...m,target:e.target.value as DocxMapping['target']}:m),docxStyles)}>{['h1','h2','h3','h4','h5','h6','paragraph','quote','code','caption','callout','ordered-list','unordered-list'].map(t=><option key={t} value={t}>{t}</option>)}</Select></label>)}</div><div className={styles.actions}><label>Additional Word style<Select aria-label="Additional Word style" value={additional} onChange={e=>setAdditional(e.target.value)}><option value="">Choose a detected style</option>{docxStyles.filter(name=>!mappings.some(m=>m.style===name)).map(name=><option key={name}>{name}</option>)}</Select></label><button disabled={!additional} type="button" onClick={()=>{setDocx(docxFile,[...mappings,{style:additional,target:'paragraph'}],docxStyles);setAdditional('')}}>Add mapping</button><button type="button" disabled={busy} onClick={()=>void apply()}>{busy?'Parsing…':'Reparse with mappings'}</button></div>{error&&<p role="alert">{error}</p>}</details>
}
