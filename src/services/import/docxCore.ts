import type { DocxMapping } from '@/types/import'
import { MAX_IMPORT_BYTES, MAX_EXPANDED_DOCX_BYTES } from './limits'

export async function inspectDocx(file: File) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('DOCX exceeds the 200 MiB file limit.')
  const buffer = await file.arrayBuffer(), view = new DataView(buffer)
  if (view.byteLength < 22 || view.getUint32(0, true) !== 0x04034b50) throw new Error('Not a readable DOCX archive. Password-protected files must be unlocked in Word first.')
  // Inspect ZIP central directory sizes before allowing decompression.
  let eocd = -1
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 65557); i--) if (view.getUint32(i,true) === 0x06054b50) { eocd=i; break }
  if (eocd < 0) throw new Error('The DOCX archive is incomplete.')
  const count = view.getUint16(eocd+10,true), start = view.getUint32(eocd+16,true)
  if (count > 50000 || count === 65535) throw new Error('DOCX archive contains too many entries.')
  let cursor=start, total=0
  for (let i=0; i<count; i++) {
    if (cursor+46>eocd || view.getUint32(cursor,true)!==0x02014b50) throw new Error('Invalid DOCX archive directory.')
    if (view.getUint16(cursor+8,true)&1) throw new Error('Encrypted DOCX entries are not supported. Save an unlocked copy.')
    total+=view.getUint32(cursor+24,true)
    if(total>MAX_EXPANDED_DOCX_BYTES) throw new Error('Expanded DOCX exceeds 512 MiB. Reduce embedded content before importing.')
    cursor+=46+view.getUint16(cursor+28,true)+view.getUint16(cursor+30,true)+view.getUint16(cursor+32,true)
  }
  const {default: JSZip} = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)
  if (!zip.file('word/document.xml')) throw new Error('This archive is not a Word DOCX document.')
  const xml = await zip.file('word/styles.xml')?.async('string') ?? ''
  const styles = new DOMParser().parseFromString(xml, 'application/xml')
  const names = Array.from(styles.getElementsByTagNameNS('*','name'), node => node.getAttribute('w:val') ?? node.getAttribute('val') ?? '').filter(Boolean)
  return { buffer, styles: [...new Set(names)].slice(0,150) }
}
export async function convertDocx(file: File, mappings: DocxMapping[], includeImages: boolean) {
  const {buffer, styles} = await inspectDocx(file)
  const {default: mammoth} = await import('mammoth')
  const tags: Record<string,string> = { heading:'h2:fresh', paragraph:'p:fresh', quote:'blockquote:fresh', code:'pre:fresh', caption:'p.caption:fresh', callout:'div.callout:fresh', 'ordered-list':'ol > li:fresh', 'unordered-list':'ul > li:fresh' }
  const styleMap = mappings.filter(m => m.style && !/['\r\n\\\]]/.test(m.style)).map(m => `p[style-name='${m.style}'] => ${/^h[1-6]$/.test(m.target) ? m.target + ':fresh' : tags[m.target] ?? 'p:fresh'}`)
  let imageBytes=0
  const result = await mammoth.convertToHtml({arrayBuffer:buffer}, {
    styleMap, includeDefaultStyleMap:true, includeEmbeddedStyleMap:false, externalFileAccess:false,
    convertImage: mammoth.images.imgElement(async image => {
      if(!includeImages || !/^image\/(png|jpeg|gif|webp)$/.test(image.contentType)) return {src:''}
      const bytes = await image.readAsArrayBuffer(); imageBytes+=bytes.byteLength
      if(imageBytes>MAX_IMPORT_BYTES) throw new Error('Embedded images exceed 200 MiB. Re-import with images disabled or reduce image sizes.')
      return {src:`data:${image.contentType};base64,${await image.readAsBase64String()}`}
    }),
  })
  return {html:result.value,messages:result.messages.map(m=>m.message),styles}
}
