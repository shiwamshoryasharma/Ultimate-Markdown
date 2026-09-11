import { downloadResource } from './remote'
import type { ImportedDocument } from '@/types/import'
import { parseDocument, walkElements } from '@/services/conversion/model'

const MAX_IMAGE=2*1024*1024, MAX_TOTAL=8*1024*1024
async function readImage(url:string,signal:AbortSignal):Promise<string> {
  const response=await fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.any([signal,AbortSignal.timeout(6000)])})
  if(!response.ok||!/^image\/(png|jpeg|gif|webp)(;|$)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw new Error('Image bytes unavailable')}
  const reader=response.body?.getReader(),chunks:Uint8Array<ArrayBuffer>[]=[];let size=0
  if(reader)try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_IMAGE){await reader.cancel();throw new Error('Image size limit')}chunks.push(new Uint8Array(value))}}finally{reader.releaseLock()}
  const blob=new Blob(chunks,{type:response.headers.get('content-type')!.split(';')[0]})
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})
}
/** Optional export copies. Markdown always keeps the resolved remote URL, even
 * when the source prevents downloading bytes. Display uses the normal image element. */
export async function resolveImportAssets(documents:ImportedDocument[],signal:AbortSignal) {
  const references=new Map<string,Set<ImportedDocument>>()
  for(const doc of documents){const {tree}=parseDocument(doc.blocks.map(b=>b.markdown).join('\n\n'),'import-assets');walkElements(tree,node=>{const src=String(node.properties.src||'');if(node.tagName==='img'&&/^https?:/i.test(src)){if(!references.has(src))references.set(src,new Set());references.get(src)!.add(doc)}})}
  const entries=[...references];let cursor=0,total=0
  await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{
    while(cursor<entries.length){
      const index=cursor++,[url,docs]=entries[index]
      if(signal.aborted) return
      try{
        if(index>=60||total>=MAX_TOTAL)throw new Error('Session image limit')
        let data:string
        try{data=await readImage(url,signal)}catch{
          if(signal.aborted)return
          const result=await downloadResource(url,'image',signal)
          if(!result.data||!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(result.data))throw new Error('Image unavailable')
          data=result.data
        }
        total+=data.length
        if(total>MAX_TOTAL)throw new Error('Session image limit')
        for(const doc of docs){doc.embeddedAssets??={};doc.embeddedAssets[url]=data}
      }catch{
        for(const doc of docs)doc.warnings.push(`Image remains linked: ${url}. Preview and Markdown keep the source URL; an embedded export copy is unavailable. Attach a local copy if needed.`)
      }
    }
  }))
}
