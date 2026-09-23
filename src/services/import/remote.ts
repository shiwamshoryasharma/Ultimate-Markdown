import { prepareImport } from './prepare'
import { downloadWithExtension } from './extension'
import type { CrawlOptions, DiscoveredPage } from '@/types/import'
import { canonicalUrl, MAX_HTML_BYTES, pageLinks } from './html'

/** The locally installed extension retrieves bytes; parsing stays in this app. */
export async function downloadResource(value:string,kind:'page'|'image',signal:AbortSignal):Promise<{url:string;html?:string;data?:string}> {
  const url=canonicalUrl(value)
  const response = await downloadWithExtension(url, kind, signal)
  if (kind === 'page') {
    // Preserve non-UTF-8 pages before the worker's UTF-8 streaming preparation.
    const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(response.blob.type)?.[1]
    let blob = response.blob
    if (charset && !/^utf-?8$/i.test(charset)) {
      let decoder: TextDecoder
      try { decoder = new TextDecoder(charset) } catch { decoder = new TextDecoder() }
      blob = new Blob([decoder.decode(await blob.arrayBuffer())], { type: 'text/html' })
    }
    const result = await prepareImport({ kind: 'html', file: blob }, signal)
    return { url: response.url, html: result.html }
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the downloaded image.'))
    reader.readAsDataURL(response.blob)
  })
  return { url: response.url, data }
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
