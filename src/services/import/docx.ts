import type { DocxMapping } from '@/types/import'
import { parseHtml } from './html'
import { prepareImport } from './prepare'

export async function importDocx(file: File, mappings: DocxMapping[], includeImages: boolean, signal?: AbortSignal) {
  const result=await prepareImport({kind:'docx',file,mappings,includeImages},signal)
  signal?.throwIfAborted()
  const doc=parseHtml(result.html,{type:'docx',name:file.name},{includeImages,extractMain:false,generated:true})
  doc.warnings.push(...(result.messages??[]))
  return {doc,styles:result.styles??[]}
}
