import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ImportSession } from '@/types/import'
import { importedSources } from '@/services/import/serialize'
import { useConversionStore } from '@/stores/conversionStore'
import { useDocumentStore } from '@/stores/documentStore'
import { downloadBinaryFile, downloadTextFile } from '@/utils/downloadFile'

export function useImportActions(session: ImportSession) {
  const navigate=useNavigate(), update=useConversionStore(s=>s.update)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const sources=useMemo(()=>importedSources(session.documents),[session.documents])
  const openMarkdown=(destination:'/workspace'|'/converter')=>{
    const store=useDocumentStore.getState(),ids:string[]=[]
    for(const source of sources.filter(s=>s.content.trim())) {
      // Each handoff is a fresh editable snapshot, preserving prior editor changes.
      const id=`import:${session.id}:${crypto.randomUUID()}`;ids.push(id)
      useDocumentStore.setState(state=>{
        const documents=new Map(state.documents)
        documents.set(id,{id,node:{kind:'file',id,name:source.path,path:source.path,extension:'md',origin:'file',standalone:true,embeddedAssets:source.embeddedAssets},content:source.content,originalContent:'',loadedAt:Date.now(),isNew:true})
        return {documents,order:[...state.order,id],activeId:id}
      })
    }
    store.setActiveDocument(ids[0])
    update({sourceMode:ids.length>1?'selected':'current'})
    navigate(destination,{state:{sourceIds:ids}})
  }
  const markdown=async()=>{
    setBusy(true);setError('')
    try {
      const included=sources.filter(s=>s.content.trim())
      if(included.length===1) downloadTextFile(included[0].content,included[0].path,'text/markdown;charset=utf-8')
      else { const {default:JSZip}=await import('jszip');const zip=new JSZip();included.forEach(s=>zip.file(s.path,s.content));downloadBinaryFile(await zip.generateAsync({type:'blob'}),'imported-markdown.zip') }
    } catch(e) {setError(String(e))} finally {setBusy(false)}
  }
  return {sources,openMarkdown,markdown,busy,error}
}
