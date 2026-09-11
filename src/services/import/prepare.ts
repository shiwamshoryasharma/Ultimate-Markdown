import type { DocxMapping } from '@/types/import'
export type ImportJob = {kind:'html';file:Blob}|{kind:'docx';file:File;mappings:DocxMapping[];includeImages:boolean}
export interface PreparedImport {html:string;styles?:string[];messages?:string[]}

/** Dedicated, disposable worker: cancellation also stops CPU-heavy parsing. */
export function prepareImport(job:ImportJob,signal?:AbortSignal):Promise<PreparedImport> {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new Error('Import stopped.'));return}
    const worker=new Worker(new URL('./prepare.worker.ts',import.meta.url),{type:'module'})
    const cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',stop)}
    const stop=()=>{cleanup();reject(new Error('Import stopped.'))}
    signal?.addEventListener('abort',stop,{once:true})
    worker.onmessage=event=>{cleanup();if(event.data.error)reject(new Error(event.data.error));else resolve(event.data.result)}
    worker.onerror=event=>{cleanup();reject(new Error(event.message||'Could not prepare this document.'))}
    worker.postMessage(job)
  })
}
