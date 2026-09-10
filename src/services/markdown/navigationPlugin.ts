import type { Element, Root, RootContent } from 'hast'
import { isRemoteUrl } from './documentLinks'

export interface NavigationItem { direction: 'previous' | 'next'; href: string; label: string }
declare module 'hast' { interface ElementData { documentNavigation?: NavigationItem[] } }
const text = (node: RootContent): string => node.type === 'text' ? node.value : 'children' in node ? node.children.map(text).join(' ') : ''
const keyword = /\b(previous|prev|back|next|continue|forward)\b/i
const direction = (label: string): NavigationItem['direction'] | null => {
  const word = label.match(keyword)?.[1]?.toLowerCase()
  if (word) return /previous|prev|back/.test(word) ? 'previous' : 'next'
  if (/[←⇐⟵⬅‹«]/u.test(label)) return 'previous'
  if (/[→⇒⟶➡›»]/u.test(label)) return 'next'
  return null
}
const separatorsOnly = (value: string) => !value.replace(/\b(previous|prev|back|next|continue|forward|document|page|chapter|navigation)\b/gi, '').replace(/[\s\p{P}\p{S}]/gu, '')

/** Recognize navigation-only blocks; never consume prose or arbitrary link lists. */
export function readNavigation(node: RootContent): NavigationItem[] | null {
  if (node.type !== 'element' || !['p','blockquote','div','section','nav','ul','ol','table'].includes(node.tagName)) return null
  if (node.tagName === 'table') {
    const rows: Element[]=[]
    const gather=(element:Element)=>{if(element.tagName==='tr') rows.push(element); else for(const child of element.children) if(child.type==='element') gather(child)}
    gather(node)
    if(rows.length===2) {
      const cells=rows.map(row=>row.children.filter((cell):cell is Element=>cell.type==='element'&&['th','td'].includes(cell.tagName)))
      if(cells.every(row=>row.length===2)&&cells[0].every(cell=>separatorsOnly(text(cell))&&direction(text(cell)))) {
        const items=cells[1].flatMap((cell,index)=>readNavigation({type:'element',tagName:'div',properties:{},children:[{type:'text',value:text(cells[0][index])+': '},...cell.children]})??[])
        if(items.length===2&&items[0].direction!==items[1].direction) return items
      }
    }
  }
  const parts: Array<string | Element> = []
  const flatten = (child: RootContent) => {
    if (child.type === 'text') parts.push(child.value)
    else if (child.type === 'element') {
      if (child.tagName === 'a') parts.push(child)
      else if (['pre','code','img','video','audio','input'].includes(child.tagName)) parts.push('not-navigation')
      else { parts.push(' '); child.children.forEach(flatten); parts.push(' ') }
    }
  }
  node.children.forEach(flatten)
  const links = parts.flatMap((part, index) => typeof part === 'string' ? [] : [{link:part,index}])
  if (!links.length || links.length > 2 || !separatorsOnly(parts.filter(part => typeof part === 'string').join(' '))) return null
  const items: NavigationItem[] = []
  for (let i=0; i<links.length; i++) {
    const {link,index} = links[i]
    const href = link.properties.href
    if (typeof href !== 'string' || isRemoteUrl(href) || !/\.(md|markdown)(?:[?#]|$)/i.test(href)) return null
    const label = text(link).trim()
    const before = parts.slice(i ? links[i-1].index+1 : 0,index).join(' ')
    const after = i === links.length-1 ? parts.slice(index+1).join(' ') : ''
    const ownDirection = direction(label)
    const side = direction(before) ?? ownDirection ?? direction(after)
    if (!side || items.some(item => item.direction === side)) return null
    const cleanLabel = label.replace(/^\s*[←⇐⟵⬅‹«→⇒⟶➡›»]*\s*(previous|prev|back|next|continue|forward)\b\s*[:：\-–—]?\s*/i,'').replace(/^[←⇐⟵⬅‹«→⇒⟶➡›»\s]+|[←⇐⟵⬅‹«→⇒⟶➡›»\s]+$/gu,'').trim()
    items.push({direction:side,href,label:cleanLabel || label || (side === 'previous' ? 'Previous document' : 'Next document')})
  }
  return items
}

/** Runs only in reading previews, after sanitization; exports keep their own rules. */
export function navigationPlugin() {
  return (tree: Root) => {
    const walk = (parent: Root | Element) => {
      const output: RootContent[] = []
      for (let i=0; i<parent.children.length; i++) {
        const child = parent.children[i]
        const items = readNavigation(child)
        if (!items) { if (child.type === 'element' && !['pre','code'].includes(child.tagName)) walk(child); output.push(child); continue }
        // Combine consecutive Previous/Next paragraphs, in either source order.
        let nextIndex=i+1
        while (nextIndex<parent.children.length) {
          const next=parent.children[nextIndex]
          if(next.type==='text'&&!next.value.trim()) {nextIndex++; continue}
          const more=readNavigation(next)
          if(!more || [...items,...more].length>2 || more.some(item=>items.some(existing=>existing.direction===item.direction))) break
          items.push(...more); i=nextIndex; nextIndex++
        }
        let previous=output.length-1
        while(previous>=0 && output[previous].type==='text' && !text(output[previous]).trim()) previous--
        const heading=output[previous]
        let id: string | undefined
        if(heading?.type==='element' && /^h[1-6]$/.test(heading.tagName) && /^(document|page|chapter)?\s*navigation$/i.test(text(heading).trim())) {
          id=typeof heading.properties.id==='string'?heading.properties.id:undefined
          output.splice(previous)
        }
        output.push({type:'element',tagName:'nav',properties:{id},data:{documentNavigation:items},children:[]})
      }
      parent.children=output as Element['children']
    }
    walk(tree)
  }
}
