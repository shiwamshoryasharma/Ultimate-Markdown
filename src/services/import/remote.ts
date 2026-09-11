import { prepareImport } from './prepare'
import type { CrawlOptions, DiscoveredPage } from '@/types/import'
import { canonicalUrl, MAX_HTML_BYTES, pageLinks } from './html'

/** App-owned downloader handles cross-origin retrieval; source parsing stays local. */
export async function downloadResource(value:string,kind:'page'|'image',signal:AbortSignal):Promise<{url:string;html?:string;data?:string}> {
  const url=canonicalUrl(value)
  const endpoint=new URL(import.meta.env.VITE_IMPORT_ENDPOINT||'api/import',new URL(import.meta.env.BASE_URL,window.location.href))
  let response:Response
  try {
    response=await fetch(endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','Accept':kind==='page'?'text/html':'application/json'},body:JSON.stringify({url,kind}),signal:AbortSignal.any([signal,AbortSignal.timeout(185000)])})
  } catch {
    if(signal.aborted)throw new Error('Import stopped.')
    throw new Error('The page could not be downloaded. Please try again in a moment.')
  }
  if(response.ok&&kind==='page'&&response.headers.get('content-type')?.includes('text/html')) {
    const blob=await response.blob()
    if(blob.size>MAX_HTML_BYTES)throw new Error('This page exceeds the 200 MiB import limit.')
    const result=await prepareImport({kind:'html',file:blob},signal)
    return {url:response.headers.get('X-Import-Final-URL')||url,html:result.html}
  }
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Web import is currently unavailable on this host. Please try again shortly.')
  const result=await response.json()
  if(!response.ok)throw new Error(result.error||'The website could not be downloaded. Check the address and try again.')
  return result
}
export async function retrievePage(value: string, signal: AbortSignal): Promise<{url:string; html:string}> {
  const result=await downloadResource(value,'page',signal)
  if(typeof result.html!=='string'||!result.html.trim())throw new Error('The website returned an empty page. Try a direct article URL.')
  if(new TextEncoder().encode(result.html).length>MAX_HTML_BYTES)throw new Error('This page exceeds the 200 MiB import limit. Choose a smaller article.')
  return {url:canonicalUrl(result.url),html:result.html}
}
export function withinScope(candidate: string, root: string, samePath: boolean) {
  const a = new URL(candidate), b = new URL(root)
  const directory = b.pathname.endsWith('/') ? b.pathname : b.pathname.slice(0,b.pathname.lastIndexOf('/')+1)
  return a.origin === b.origin && (!samePath || a.pathname.startsWith(directory)) && !a.search
}
export async function discoverPages(root: string, options: CrawlOptions, signal: AbortSignal, progress: (pages: DiscoveredPage[]) => void) {
  root = canonicalUrl(root)
  const queue = [{url:root,depth:0,title:'Starting page'}], seen = new Set([root]), fetched = new Set<string>(), pages:DiscoveredPage[]=[]
  const maxPages = Math.min(30, Math.max(1,options.maxPages)), maxDepth = Math.min(3,Math.max(0,options.maxDepth))
  let bytes=0
  for (let index=0;index<queue.length && pages.length<maxPages;index++) {
    if(signal.aborted) break
    const entry=queue[index]
    try {
      const result=await retrievePage(entry.url,signal)
      if(!withinScope(result.url,root,options.samePath)) throw new Error('Redirect left the selected documentation scope.')
      if(fetched.has(result.url)) continue
      fetched.add(result.url); seen.add(result.url)
      if(!result.html) throw new Error('The page returned no HTML.')
      bytes+=new TextEncoder().encode(result.html).length
      if(bytes>MAX_HTML_BYTES) { pages.push({...entry,selected:false,error:'Discovery stopped at the 200 MiB session limit.'}); break }
      const title=new DOMParser().parseFromString(result.html,'text/html').querySelector('h1, title')?.textContent?.trim() || entry.title
      pages.push({...entry,url:result.url,title,selected:entry.depth===0,html:result.html})
      if(options.followLinks && entry.depth<maxDepth) for(const [url,label] of pageLinks(result.html,result.url)) {
        if(!seen.has(url)&&withinScope(url,root,options.samePath)&&queue.length<maxPages) { seen.add(url); queue.push({url,title:label,depth:entry.depth+1}) }
      }
    } catch(error) { if(signal.aborted) break; pages.push({...entry,selected:false,error:error instanceof Error?error.message:'Page unavailable.'}) }
    progress([...pages])
  }
  return pages
}
