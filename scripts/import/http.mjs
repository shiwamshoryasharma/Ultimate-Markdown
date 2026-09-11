import { DownloadError, downloadUrl, validateTarget } from './download.mjs'

/** Narrow public-document endpoint. Memory only: bounded 60-second cache,
 * bounded concurrency and per-client/global request limits. */
export function createImportHandler({allowedOrigins=[],download=downloadUrl,now=Date.now}={}){
  const cache=new Map(),pending=new Map(),rates=new Map()
  let cacheBytes=0,windowStart=now(),globalCount=0
  function cacheDelete(key){const item=cache.get(key);if(item){cacheBytes-=item.size;cache.delete(key)}}
  return async function handleImport(req,res){
    const origin=String(req.headers.origin||'')
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'}
    const send=(status,value)=>{if(!res.destroyed){if(status===200&&typeof value.html==='string'&&String(req.headers.accept).includes('text/html')){res.writeHead(status,{...headers,'Content-Type':'text/html; charset=utf-8','X-Import-Final-URL':value.url,'Access-Control-Expose-Headers':'X-Import-Final-URL'});res.end(value.html)}else{res.writeHead(status,headers);res.end(JSON.stringify(value))}}}
    if(!origin||!allowedOrigins.includes(origin)){send(403,{error:'This app address is not enabled for webpage imports.'});return}
    headers['Access-Control-Allow-Origin']=origin
    if(req.method==='OPTIONS'){res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});res.end();return}
    if(req.method!=='POST'){send(405,{error:'Use POST to import a webpage.'});return}
    if(now()-windowStart>=60000){rates.clear();globalCount=0;windowStart=now()}
    // Deliberately do not trust client-supplied X-Forwarded-For headers.
    const client=req.socket.remoteAddress||'unknown',count=(rates.get(client)||0)+1
    if(count>90||++globalCount>240){send(429,{error:'Too many imports at once. Please wait a minute and try again.'});return}
    rates.set(client,count)
    try{
      if(!String(req.headers['content-type']).includes('application/json'))throw new DownloadError('Expected a JSON import request.',415)
      const chunks=[];let size=0
      req.setTimeout(10000,()=>req.destroy())
      for await(const chunk of req){size+=chunk.length;if(size>4096)throw new DownloadError('The import request is too large.',413);chunks.push(chunk)}
      req.setTimeout(0)
      let body
      try{body=JSON.parse(Buffer.concat(chunks).toString())}catch{throw new DownloadError('Invalid import request.')}
      if(!body||typeof body.url!=='string'||!['page','image'].includes(body.kind))throw new DownloadError('Expected a URL and page/image kind.')
      const url=validateTarget(body.url).href,key=JSON.stringify([body.kind,url])
      for(const [cached,item]of cache)if(item.expires<=now())cacheDelete(cached)
      if(cache.has(key)){const item=cache.get(key);cache.delete(key);cache.set(key,item);send(200,item.value);return}
      if(!pending.has(key)){
        if(pending.size>=8||(body.kind==='page'&&[...pending.keys()].some(key=>JSON.parse(key)[0]==='page')))throw new DownloadError('Imports are busy. Please try again shortly.',429)
        const job=download(url,body.kind).then(value=>{
          const size=Buffer.byteLength(value.html??value.data??'')
          while(cache.size&&(cache.size>=20||cacheBytes+size>16*1024*1024))cacheDelete(cache.keys().next().value)
          if(size<=16*1024*1024){
            const expires=now()+60000
            cache.set(key,{value,size,expires});cacheBytes+=size
            setTimeout(()=>{if(cache.get(key)?.expires===expires)cacheDelete(key)},60000).unref()
          }
          return value
        }).finally(()=>pending.delete(key))
        pending.set(key,job)
      }
      send(200,await pending.get(key))
    }catch(error){
      send(error instanceof DownloadError?error.status:502,{error:error instanceof DownloadError?error.message:error?.name==='TimeoutError'||error?.name==='AbortError'?'The website took too long to respond. Try again or choose a smaller page.':'The website could not be downloaded. Check the address and try again.'})
    }
  }
}
