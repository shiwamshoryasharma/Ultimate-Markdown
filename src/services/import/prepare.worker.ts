import { Parser } from 'htmlparser2'
import { DOMParser as XmlParser } from '@xmldom/xmldom'
import { MAX_IMPORT_BYTES } from './limits'
import type { ImportJob } from './prepare'

// Mammoth's browser XML reader needs a DOM parser; no window or page scripts run here.
Object.assign(globalThis,{DOMParser:XmlParser})
const escapeText=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])

async function prepareHtml(file:Blob) {
  const output:string[]=[], stack:{name:string;skip:boolean}[]=[]
  const parser=new Parser({
    onopentag(name,attrs){
      const skip=!!stack.at(-1)?.skip||['script','style','iframe','object','embed','button','form','textarea','select','svg'].includes(name)||attrs.role==='button'
      stack.push({name,skip})
      if(skip)return
      const attributes=Object.entries(attrs).filter(([key])=>!key.startsWith('on')&&key!=='style').map(([key,value])=>` ${key}="${escapeText(value).replaceAll('"','&quot;')}"`).join('')
      output.push(`<${name}${attributes}>`)
    },
    ontext(text){if(!stack.at(-1)?.skip)output.push(escapeText(text))},
    onclosetag(name){const entry=stack.pop();if(!entry?.skip&&!voidTags.has(name))output.push(`</${name}>`)},
  },{decodeEntities:true})
  const reader=file.stream().getReader(),decoder=new TextDecoder()
  try{while(true){const {done,value}=await reader.read();if(done)break;parser.write(decoder.decode(value,{stream:true}))}parser.end(decoder.decode())}finally{reader.releaseLock()}
  // DOMPurify still sanitizes the resulting HTML before any preview is rendered.
  return {html:output.join('')}
}
self.onmessage=async(event:MessageEvent<ImportJob>)=>{
  try {
    const job=event.data
    if(job.file.size>MAX_IMPORT_BYTES)throw new Error('This file exceeds the 200 MiB import limit.')
    const result=job.kind==='html'?await prepareHtml(job.file):await (await import('./docxCore')).convertDocx(job.file,job.mappings,job.includeImages)
    self.postMessage({result})
  }catch(error){self.postMessage({error:error instanceof Error?error.message:'Could not prepare this document.'})}
}
