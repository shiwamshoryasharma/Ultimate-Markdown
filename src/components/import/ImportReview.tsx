import { useState } from 'react'
import { useImportActions } from '@/hooks/useImportActions'
import { Copy, Download, Eye, Code2, SlidersHorizontal, FileOutput, FileCode2, Check, Pencil, X } from 'lucide-react'
import { useConfirmation } from '@/hooks/useConfirmation'
import { ArrowDown, ArrowUp, RotateCcw, Trash2 } from 'lucide-react'
import { MarkdownPreview } from '@/components/preview/MarkdownPreview'
import { Select } from '@/components/common/Select'
import { useImportStore } from '@/stores/importStore'
import type { ImportSession } from '@/types/import'
import { BLOCK_TYPES, type ImportBlockType } from '@/types/import'
import { convertBlock, reviewWarnings } from '@/services/import/serialize'
import { DocxStyleMappings } from './DocxStyleMappings'
import { ImportOutput } from './ImportOutput'
import styles from './Import.module.css'

export function ImportReview() {
  const session=useImportStore(s=>s.session)
  return session?<ReviewDocument key={session.id} session={session}/>:null
}

function ReviewDocument({session}:{session:ImportSession}) {
  const confirm=useConfirmation()
  const {updateBlock,moveBlock}=useImportStore()
  const {sources,openMarkdown,markdown,busy,error}=useImportActions(session)
  const [copied,setCopied]=useState(false),[copyError,setCopyError]=useState('')
  const [mode,setMode]=useState<'preview'|'markdown'|'edit'|'output'>('preview'),[docId,setDocId]=useState(''),[active,setActive]=useState(''),[editing,setEditing]=useState('')
  const doc=session.documents.find(d=>d.id===docId)??session.documents[0]
  const [sectionPage,setSectionPage]=useState(0)
  const warnings=reviewWarnings(doc)
  const focus=(id:string)=>{setMode('edit');setActive(id);setSectionPage(Math.floor(doc.blocks.findIndex(b=>b.id===id)/100));requestAnimationFrame(()=>{const block=document.getElementById(id);block?.scrollIntoView({block:'center',behavior:'auto'});block?.focus({preventScroll:true})})}
  const source=sources.find(s=>s.id===doc.id)!
  const shownBlocks=doc.blocks.slice(sectionPage*100,(sectionPage+1)*100)
  const previewContent=doc.blocks.length>100?shownBlocks.filter(b=>b.include&&!b.removed).map(b=>b.markdown).join('\n\n'):source.content
  const previewText=previewContent.slice(0,200000)
  const hasContent=sources.some(s=>s.content.trim())
  const copy=async()=>{try {await navigator.clipboard.writeText(source.content);setCopied(true);setCopyError('')} catch {setCopyError('Clipboard unavailable. Use Download .md to save your Markdown.')}}
  return <section className={styles.review} aria-label="Custom Preview">
    <header className={styles.resultHeader}>
      <div className={styles.resultTitle}><span className={styles.documentIcon}><FileCode2 size={24}/></span><div><span className={styles.eyebrow}>MARKDOWN READY</span><h2>{doc.title}</h2><p>{doc.source.url?<a href={doc.source.url} target="_blank" rel="noreferrer">{doc.source.url}</a>:doc.source.name}</p></div></div>
      <button className={styles.quietButton} type="button" aria-label="Close import session" title="Close import" onClick={async()=>{if(await confirm({title:'Close this import review?',description:'Your temporary source and review edits will be discarded. Download or open the Markdown first to keep them.',confirmLabel:'Discard review',cancelLabel:'Keep reviewing'}))useImportStore.getState().closeSession()}}><X size={18}/></button>
    </header>
    <div className={styles.resultToolbar}>
      <div className={styles.tabs} role="group" aria-label="Import preview modes">{([{id:'preview',label:'Preview',icon:Eye},{id:'markdown',label:'Markdown',icon:Code2},{id:'edit',label:'Edit blocks',icon:SlidersHorizontal}] as const).map(({id,label,icon:Icon})=><button key={id} type="button" aria-pressed={mode===id} onClick={()=>{setMode(id);setCopied(false)}}><Icon size={16}/>{label}</button>)}</div>
      <div className={styles.exportActions}><button type="button" className={styles.quietButton} disabled={!source.content.trim()} onClick={()=>void copy()}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copied':'Copy Markdown'}</button><button type="button" className={styles.primary} disabled={!hasContent||busy} onClick={()=>void markdown()}><Download size={17}/>{busy?'Preparing…':sources.length>1?'Download .md ZIP':'Download .md'}</button></div>
    </div>
    <div className={styles.resultMeta}>
      {session.documents.length>1?<label>Document<Select aria-label="Imported document" value={doc.id} onChange={e=>{setDocId(e.target.value);setActive('');setCopied(false);setSectionPage(0)}}>{session.documents.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</Select></label>:<span>{source.path} <span aria-hidden="true">·</span> {source.content.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>}
      <div><button className={styles.quietButton} type="button" disabled={!hasContent} onClick={()=>openMarkdown('/workspace')}><Pencil size={15}/>Open in editor</button><button className={styles.quietButton} type="button" aria-pressed={mode==='output'} onClick={()=>setMode(mode==='output'?'preview':'output')}><FileOutput size={15}/>More formats</button></div>
    </div>
    {(error||copyError)&&<p className={styles.error} role="alert">{error||copyError}</p>}
    {(warnings.length>0||doc.warnings.length>0)&&<details className={styles.quality}><summary>{warnings.length?`${warnings.length} items to check`:'Import notes'}<span>Optional review</span></summary><div className={styles.qualityContent}>{doc.warnings.map((message,i)=><p key={i}>{message}</p>)}{warnings.map((warning,i)=><button type="button" key={i} onClick={()=>focus(warning.blockId)}>{warning.message}</button>)}</div></details>}
    {doc.blocks.length>100&&<div className={styles.previewPages}><span>Sections {sectionPage*100+1}–{Math.min((sectionPage+1)*100,doc.blocks.length)} of {doc.blocks.length.toLocaleString()} · Downloads include all sections</span><button type="button" disabled={sectionPage===0} onClick={()=>setSectionPage(sectionPage-1)}>Previous</button><button type="button" disabled={(sectionPage+1)*100>=doc.blocks.length} onClick={()=>setSectionPage(sectionPage+1)}>Next</button></div>}
    {previewContent.length>200000&&<p className={styles.note}>This large section is shortened in the preview. Your Markdown download includes the complete content.</p>}
    {mode==='preview'?<div className={styles.documentPreview}><MarkdownPreview content={previewText} documentPath={source.path} workspace={null} contentWidth="full"/></div>:mode==='markdown'?<><pre className={styles.markdownSource} tabIndex={0} aria-label="Markdown source">{previewText||'All blocks are excluded. Keep a block to export.'}</pre><details className={styles.sourceDetails}><summary>Original HTML</summary><pre className={styles.original}>{doc.originalHtml.slice(0,200000)}</pre>{doc.originalHtml.length>200000&&<p>Showing the first 200,000 characters of the original HTML.</p>}</details></>:mode==='output'?<ImportOutput session={session}/>:<div className={styles.blocks}>
      <div className={styles.editIntro}><p>Edit, exclude or reorder sections. Your changes appear in the preview and Markdown download.</p><button type="button" className={styles.quietButton} onClick={()=>setMode('preview')}>Done editing</button></div>
      <DocxStyleMappings/>
        {shownBlocks.map((block,n)=>{const i=sectionPage*100+n;return <article id={block.id} key={block.id} tabIndex={-1} className={styles.block} data-active={active===block.id} data-excluded={!block.include||block.removed} onFocus={()=>setActive(block.id)}>
          <div className={styles.blockTools}><label className={styles.check}><input type="checkbox" checked={block.include&&!block.removed} disabled={block.removed} aria-label={`Keep block ${i+1}`} onChange={e=>updateBlock(doc.id,block.id,{include:e.target.checked})}/>Keep</label><Select aria-label={`Block ${i+1} type`} disabled={block.removed} value={block.type} onChange={e=>{const type=e.target.value as ImportBlockType;updateBlock(doc.id,block.id,{type,markdown:convertBlock(block.markdown,type)})}}>{BLOCK_TYPES.map(type=><option key={type}>{type}</option>)}</Select><button type="button" disabled={i===0} aria-label={`Move block ${i+1} up`} onClick={()=>moveBlock(doc.id,block.id,-1)}><ArrowUp size={15}/></button><button type="button" disabled={i===doc.blocks.length-1} aria-label={`Move block ${i+1} down`} onClick={()=>moveBlock(doc.id,block.id,1)}><ArrowDown size={15}/></button>{block.removed?<button type="button" onClick={()=>updateBlock(doc.id,block.id,{removed:false,include:true})}><RotateCcw size={15}/>Restore</button>:<><button type="button" onClick={()=>setEditing(editing===block.id?'':block.id)}>{editing===block.id?'Done editing':'Edit'}</button><button type="button" aria-label={`Remove block ${i+1}`} onClick={()=>updateBlock(doc.id,block.id,{removed:true})}><Trash2 size={15}/></button></>}</div>
          {block.removed?<p>Removed from output. Restore to edit this block.</p>:<>{!block.include&&<p className={styles.note}>Excluded from final output; retained in this review.</p>}{editing===block.id&&<label className={styles.blockEditor}>Markdown content<textarea aria-label={`Edit block ${i+1}`} rows={6} value={block.markdown} onChange={e=>updateBlock(doc.id,block.id,{markdown:e.target.value})}/></label>}<MarkdownPreview content={block.markdown} documentPath="import-preview.md" workspace={null} contentWidth="full"/>{warnings.filter(w=>w.blockId===block.id).map((w,n)=><p className={styles.blockWarning} key={n}>{w.message}</p>)}</>}
        </article>})}
        <button type="button" className={styles.primary} onClick={()=>setMode('preview')}>Done editing</button>
      </div>}
  </section>
}
