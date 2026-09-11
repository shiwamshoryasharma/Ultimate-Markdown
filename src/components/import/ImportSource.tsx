import { prepareImport } from '@/services/import/prepare'
import { useConfirmation } from '@/hooks/useConfirmation'
import { resolveImportAssets } from '@/services/import/assets'
import { useEffect, useRef, useState } from 'react'
import { FileCode2, FileText, Globe, Network } from 'lucide-react'
import { parseHtml, canonicalUrl, MAX_HTML_BYTES } from '@/services/import/html'
import { importDocx } from '@/services/import/docx'
import { discoverPages, retrievePage } from '@/services/import/remote'
import { useImportStore } from '@/stores/importStore'
import { DEFAULT_DOCX_MAPPINGS, type CrawlOptions, type DiscoveredPage } from '@/types/import'
import styles from './Import.module.css'

const sources = [
  {id:'url',name:'Web Page',detail:'Extract an article or documentation page.',icon:Globe},
  {id:'site',name:'Documentation Site',detail:'Discover connected pages and choose what to import.',icon:Network},
  {id:'docx',name:'Word Document',detail:'Import DOCX structure, styles and images.',icon:FileText},
  {id:'html',name:'HTML',detail:'Paste HTML or open a saved page.',icon:FileCode2},
] as const
export function ImportSource() {
  const confirm=useConfirmation()
  const [kind,setKind]=useState<typeof sources[number]['id']>('url')
  const [url,setUrl]=useState(''), [html,setHtml]=useState(''), [file,setFile]=useState<File|null>(null)
  const [images,setImages]=useState<File[]>([]), [busy,setBusy]=useState(false), [error,setError]=useState('')
  const [progress,setProgress]=useState('')
  const [pages,setPages]=useState<DiscoveredPage[]>([])
  const [options,setOptions]=useState<CrawlOptions>({samePath:true,maxDepth:1,maxPages:10,includeImages:true,followLinks:true})
  const controller=useRef<AbortController|null>(null)
  useEffect(()=>()=>controller.current?.abort(),[])
  const run=async(action:(signal:AbortSignal)=>Promise<void>)=>{
    controller.current?.abort(); const current=new AbortController();controller.current=current
    setBusy(true);setError('');setProgress('Parsing document…')
    try { await action(current.signal) } catch(reason) {setError(reason instanceof Error?reason.message:'Import failed.')}
    finally {setBusy(false)}
  }
  const attachLocalImages=async(doc:ReturnType<typeof parseHtml>)=>{
    const data=new Map<string,string>()
    let total=0
    for(const image of images) {
      if(!/^image\/(png|jpeg|gif|webp)$/.test(image.type)) continue
      total+=image.size
      if(total>8*1024*1024) throw new Error('Local image attachments exceed 8 MB.')
      const value=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Cannot read '+image.name));reader.readAsDataURL(image)})
      data.set(image.webkitRelativePath || image.name,value)
    }
    for(const block of doc.blocks) {
      for(const match of block.markdown.matchAll(/!\[[^\]]*\]\(([^\s)]+)\)/g)) {
        if(/^(https?:|data:)/.test(match[1])) continue
        let path=match[1];try {path=decodeURIComponent(path)} catch { /* retain source */ }
        const normalized=path.replace(/^\.\//,'')
        const candidates=[...data].filter(([name])=>name===normalized || name.endsWith('/'+normalized) || name.split('/').at(-1)===normalized.split('/').at(-1))
        if(candidates.length===1) {
          block.markdown=block.markdown.replaceAll(match[1],candidates[0][1])
          block.warnings=block.warnings.filter(w=>!w.startsWith('Unresolved local image: '+match[1]))
        }
      }
    }
    return doc
  }
  const replaceSession=()=>!useImportStore.getState().session || confirm({title:'Replace this import review?',description:'Importing another document will replace your current review, including unsaved block changes.',confirmLabel:'Replace review',cancelLabel:'Keep reviewing'})
  const parse=async(signal:AbortSignal)=>{
    if(!await replaceSession() || signal.aborted) return
    if(kind==='docx') {
      if(!file) throw new Error('Choose a DOCX file first.')
      const {doc,styles:found}=await importDocx(file,DEFAULT_DOCX_MAPPINGS,options.includeImages,signal)
      if(signal.aborted) return
      useImportStore.getState().setDocx(file,DEFAULT_DOCX_MAPPINGS,found,options.includeImages)
      useImportStore.getState().setDocuments([doc]);return
    }
    if(kind==='html') {
      if(file && file.size>MAX_HTML_BYTES) throw new Error('HTML file exceeds 200 MiB.')
      const content=(await prepareImport({kind:'html',file:file??new Blob([html],{type:'text/html'})},signal)).html
      if(!content.trim()) throw new Error('Paste HTML or choose an HTML file first.')
      const doc=parseHtml(content,{type:'html',name:file?.name || 'Pasted HTML',url:url.trim()?canonicalUrl(url):undefined},{includeImages:options.includeImages})
      if(options.includeImages) await attachLocalImages(doc)
      if(signal.aborted) return
      useImportStore.getState().setDocx(null,DEFAULT_DOCX_MAPPINGS,[])
      useImportStore.getState().setDocuments([doc]);return
    }
    const selected=kind==='site'?pages.filter(p=>p.selected&&!p.error):[]
    if(kind==='site'&&!selected.length) throw new Error('Discover pages, then select at least one readable page.')
    setProgress('Retrieving page…')
    const fetched=kind==='site'?selected: [await retrievePage(url,signal)]
    setProgress('Preparing preview…')
    const documents=fetched.map(page=>parseHtml(page.html||'',{type:'url',name:new URL(page.url).pathname,url:page.url},{includeImages:kind==='url'||options.includeImages}))
    setProgress('Resolving images…')
    if(kind==='url'||options.includeImages) await resolveImportAssets(documents,signal)
    if(signal.aborted) return
    useImportStore.getState().setDocx(null,DEFAULT_DOCX_MAPPINGS,[])
    useImportStore.getState().setDocuments(documents)
  }
  return <section className={styles.source} aria-label="Import sources">
    <div className={styles.sourceCards}>{sources.map(({id,name,detail,icon:Icon})=><button key={id} type="button" aria-pressed={kind===id} disabled={busy} onClick={()=>{setKind(id);setFile(null);setError('');setPages([])}}><Icon size={23}/><strong>{name}</strong><small>{detail}</small></button>)}</div>
    <div className={styles.form} data-kind={kind}>
      {(kind==='url'||kind==='site'||kind==='html')&&<label>{kind==='html'?'Source URL (optional, resolves relative links)':'Page URL'}<input type="url" value={url} placeholder="https://docs.example.com/guide/" onChange={e=>{setUrl(e.target.value);setPages([])}} disabled={busy}/></label>}
      {kind==='html'&&<><label>Paste HTML<textarea value={html} onChange={e=>{setHtml(e.target.value);setFile(null)}} rows={6} placeholder="<article><h1>Your document</h1>…</article>" disabled={busy}/></label><label>Or choose HTML (up to 200 MiB)<input type="file" accept=".html,.htm,text/html" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)}/></label><label>Image files (optional)<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple disabled={busy} onChange={e=>setImages(Array.from(e.target.files??[]))}/><small>Use matching relative filenames. Ambiguous/missing paths are marked for review.</small></label></>}
      {kind==='docx'&&<label>Choose DOCX<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)}/><small>Up to 200 MiB. Style mappings are available after parsing.</small></label>}
      {kind!=='url'&&<label className={styles.check}><input type="checkbox" checked={options.includeImages} disabled={busy} onChange={e=>setOptions({...options,includeImages:e.target.checked})}/>Include images</label>}

      {kind==='site'&&<><div className={styles.crawl}><label className={styles.check}><input type="checkbox" checked disabled/>Same domain only · never follow external pages</label><label className={styles.check}><input type="checkbox" checked={options.samePath} disabled={busy} onChange={e=>{setOptions({...options,samePath:e.target.checked});setPages([])}}/>Same documentation path only</label><label className={styles.check}><input type="checkbox" checked={options.followLinks} disabled={busy} onChange={e=>{setOptions({...options,followLinks:e.target.checked});setPages([])}}/>Follow internal links</label><label>Maximum crawl depth<input type="number" min={0} max={3} value={options.maxDepth} disabled={busy} onChange={e=>{setOptions({...options,maxDepth:Math.max(0,Math.min(3,Number(e.target.value)))});setPages([])}}/></label><label>Maximum page count<input type="number" min={1} max={30} value={options.maxPages} disabled={busy} onChange={e=>{setOptions({...options,maxPages:Math.max(1,Math.min(30,Number(e.target.value)))});setPages([])}}/></label></div><button type="button" disabled={busy} onClick={()=>void run(async signal=>{setPages([]);setPages(await discoverPages(url,options,signal,setPages))})}>Discover pages</button><p className={styles.note}>Discovery reads page HTML to find titles and links. Only selected pages enter the review. Duplicate URLs and query variants are skipped.</p>{pages.length>0&&<fieldset className={styles.pageList}><legend>Choose documentation pages ({pages.length})</legend>{pages.map((page,i)=><label key={page.url} style={{paddingLeft:12+page.depth*18}}><input type="checkbox" disabled={busy||!!page.error} checked={page.selected} onChange={e=>setPages(pages.map((p,n)=>n===i?{...p,selected:e.target.checked}:p))}/><span><strong>{page.title}</strong><small>{page.url}</small>{page.error&&<small role="status">{page.error}</small>}</span></label>)}</fieldset>}</>}
      {error&&<div role="alert" className={styles.error}><p>{error}</p>{(kind==='url'||kind==='site')&&<button type="button" onClick={()=>{setKind('html');setFile(null);setError('')}}>Import saved or pasted HTML</button>}</div>}
      <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy} onClick={()=>void run(parse)}>{busy?progress:kind==='site'?'Review selected pages':kind==='url'?'Convert to Markdown':'Parse & review'}</button>{busy&&<button type="button" onClick={()=>controller.current?.abort()}>Stop import</button>}</div>
    </div>
  </section>
}
