import { lookup as systemLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

export class DownloadError extends Error {
  constructor(message,status=400){super(message);this.status=status}
}
export function isPublicAddress(address){
  if(isIP(address)===6){
    const ip=new URL(`http://[${address}]/`).hostname.slice(1,-1).toLowerCase()
    return /^[23][0-9a-f]{0,3}:/.test(ip)&&!/^(2001:(?:0|1|2|db8|1[0-9a-f]|2[0-9a-f]):|2002:|3fff:)/.test(ip)
  }
  if(isIP(address)!==4)return false
  const [a,b,c]=address.split('.').map(Number)
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2||b===88&&c===99)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113)
}
export function validateTarget(value){
  let url
  try{url=new URL(value)}catch{throw new DownloadError('Enter a complete HTTP or HTTPS webpage URL.')}
  if(typeof value!=='string'||value.length>2048||!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port)throw new DownloadError('Use a public HTTP or HTTPS URL on a standard port, without credentials.')
  const host=url.hostname.toLowerCase()
  if(isIP(host)||host.includes(':')||!host.includes('.')||host.endsWith('.')||/(?:^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host))throw new DownloadError('Local, private and IP-address destinations cannot be imported.',403)
  url.hash=''
  return url
}
async function deadline(promise,signal){
  signal.throwIfAborted()
  let stop
  try{return await Promise.race([promise,new Promise((_,reject)=>{stop=()=>reject(signal.reason);signal.addEventListener('abort',stop,{once:true})})])}
  finally{signal.removeEventListener('abort',stop)}
}
/** Resolve once, validate every address, then pin the connection to a checked IP.
 * TLS still validates the original hostname. No pooled connection or redirect
 * can skip destination checks; no user cookies/headers are forwarded. */
export async function openPublicResponse(url,signal,{lookup=systemLookup,request}={}){
  const addresses=await deadline(lookup(url.hostname,{all:true,verbatim:true}),signal)
  if(!addresses.length||addresses.some(entry=>!isPublicAddress(entry.address)))throw new DownloadError('This address resolves to a private or unsupported network.',403)
  signal.throwIfAborted()
  const address=addresses.find(entry=>entry.family===4)||addresses[0]
  const send=request||(url.protocol==='https:'?httpsRequest:httpRequest)
  return new Promise((resolve,reject)=>{
    const outgoing=send(url,{
      method:'GET',agent:false,signal,family:address.family,servername:url.hostname,
      lookup:(_hostname,options,callback)=>options.all?callback(null,[address]):callback(null,address.address,address.family),
      headers:{Accept:'text/html,application/xhtml+xml,image/png,image/jpeg,image/gif,image/webp','Accept-Encoding':'identity','User-Agent':'UltimateMarkdown/1.0 (public document import)'},
    },resolve)
    outgoing.once('error',reject);outgoing.end()
  })
}
async function readBody(response,maxBytes){
  if(Number(response.headers['content-length'])>maxBytes){response.destroy();throw new DownloadError('The source exceeds the import size limit. Choose a smaller page or image.',413)}
  const encoding=String(response.headers['content-encoding']||'identity').toLowerCase()
  const decompress=encoding==='gzip'?createGunzip():encoding==='br'?createBrotliDecompress():encoding==='deflate'?createInflate():null
  if(encoding!=='identity'&&!decompress){response.destroy();throw new DownloadError('The source uses an unsupported compression format.',415)}
  const stream=decompress?response.pipe(decompress):response
  if(decompress)response.once('error',error=>decompress.destroy(error))
  const chunks=[];let size=0
  try{
    for await(const chunk of stream){size+=chunk.length;if(size>maxBytes)throw new DownloadError('The source exceeds the import size limit. Choose a smaller page or image.',413);chunks.push(chunk)}
    return Buffer.concat(chunks)
  }finally{stream.destroy();response.destroy()}
}
export async function downloadUrl(value,kind='page',options={}){
  let url=validateTarget(value)
  const signal=options.signal||AbortSignal.timeout(180000),seen=new Set()
  for(let redirects=0;redirects<=4;redirects++){
    if(seen.has(url.href))throw new DownloadError('The source has a redirect loop.',422)
    seen.add(url.href)
    const response=await openPublicResponse(url,signal,options)
    const status=response.statusCode||502
    if([301,302,303,307,308].includes(status)){
      const target=response.headers.location;response.destroy()
      if(!target)throw new DownloadError('The source redirected without a destination.',502)
      url=validateTarget(new URL(target,url).href);continue
    }
    if(status<200||status>=300){response.destroy();throw new DownloadError(`The source website returned HTTP ${status}. Try a different public page.`,502)}
    const type=String(response.headers['content-type']||''),mime=type.split(';')[0].trim().toLowerCase()
    if(!(kind==='page'?['text/html','application/xhtml+xml'].includes(mime):/^image\/(png|jpeg|gif|webp)$/.test(mime))){response.destroy();throw new DownloadError(kind==='page'?'This URL does not contain an HTML webpage.':'This image format cannot be embedded.',415)}
    const bytes=await readBody(response,kind==='page'?200*1024*1024:2*1024*1024)
    if(kind==='image'){
      const valid=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/gif'?/^GIF8[79]a/.test(bytes.subarray(0,6).toString()):bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'
      if(!valid)throw new DownloadError('The image content does not match its declared format.',415)
      return {url:url.href,data:`data:${mime};base64,${bytes.toString('base64')}`}
    }
    const charset=/charset\s*=\s*["']?([^\s;"']+)/i.exec(type)?.[1]
    let decoder
    try{decoder=new TextDecoder(charset||'utf-8')}catch{decoder=new TextDecoder()}
    return {url:url.href,html:decoder.decode(bytes)}
  }
  throw new DownloadError('The source redirects too many times.',422)
}
