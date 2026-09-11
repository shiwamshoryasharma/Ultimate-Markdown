import type { ImportedDocument, ImportBlockType } from '@/types/import'
import { slugify } from '@/services/markdown/slug'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import type { RootContent } from 'mdast'

export function documentMarkdown(doc: ImportedDocument): string {
  return doc.blocks.filter(b => b.include && !b.removed).map(b => b.markdown).join('\n\n').trim()
}
export function importedSources(documents: ImportedDocument[]) {
  const names = new Map(documents.map((doc, i) => [doc.source.url, `${documents.length>1?`${i+1}-`:''}${doc.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 70) || 'document'}.md`]))
  return documents.map((doc, index) => {
    const raw = documentMarkdown(doc)
    const processor=unified().use(remarkParse).use(remarkGfm).use(remarkStringify,{bullet:'-',fences:true})
    const tree=processor.parse(documents.length>1?raw:'')
    let changed=false
    const walk=(nodes:RootContent[])=>{for(const node of nodes){
      if((node.type==='link'||node.type==='definition')&&/^https?:/.test(node.url)) {
        const url=new URL(node.url),hash=url.hash;url.hash=''
        const path=names.get(url.href)
        if(path){node.url=path+hash;changed=true}
      }
      if('children' in node) walk(node.children as RootContent[])
    }}
    walk(tree.children)
    const content=changed?processor.stringify(tree).trim():raw
    return { id: doc.id, path: doc.source.url ? names.get(doc.source.url)! : `${documents.length>1?`${index+1}-`:''}${doc.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0,70) || 'document'}.md`, content, standalone: true, assetWorkspace: null, embeddedAssets:doc.embeddedAssets }
  })
}
export function convertBlock(markdown: string, type: ImportBlockType): string {
  const text = markdown.replace(/^#{1,6}\s+/gm, '').replace(/^>\s?/gm, '').replace(/^\s*(?:[-*+] |\d+\. )/gm, '').replace(/^(`{3,}|~{3,}).*\n?|^(`{3,}|~{3,})$/gm, '').trim()
  if (type === 'heading') return '## ' + text.replace(/\n+/g, ' ')
  if (type === 'code') { const fence = '`'.repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), m => m[0].length + 1))); return `${fence}\n${text}\n${fence}` }
  if (type === 'quote' || type === 'callout') return (type === 'callout' ? '> **Note**\n>\n' : '') + text.split('\n').map(line => '> ' + line).join('\n')
  if (type === 'unordered-list' || type === 'ordered-list') return text.split(/\n+/).map((line,i) => `${type === 'ordered-list' ? `${i+1}.` : '-'} ${line}`).join('\n')
  if (type === 'divider') return '---'
  if (type === 'caption') return `*${text}*`
  if (type === 'image') return /^!\[/.test(markdown) ? markdown : `![${text.replace(/[[\]]/g, '')}](image.png)`
  if (type === 'table') return /^\s*[|<]/.test(markdown) ? markdown : `| Content |\n| --- |\n| ${text.replace(/\n/g,' ').replace(/\|/g,'\\|')} |`
  return text
}
export function reviewWarnings(doc: ImportedDocument): { blockId: string; message: string }[] {
  const seen = new Set<string>(), slugs = new Map<string, number>(), anchors = new Set<string>()
  const blocks = doc.blocks.filter(b => b.include && !b.removed)
  for (const b of blocks) for (const heading of b.markdown.matchAll(/^#{1,6}\s+(.+)$/gm)) anchors.add(slugify(heading[1], slugs))
  return blocks.flatMap(block => {
    const warnings = [...block.warnings]
    if (block.type === 'heading') { const name = block.markdown.replace(/^#+\s*/, '').trim(); if (seen.has(name)) warnings.push('Duplicate heading; check document structure.'); seen.add(name) }
    if (!block.markdown.trim() && block.type !== 'divider') warnings.push('Empty block.')
    for (const match of block.markdown.matchAll(/\]\(#([^)]*)\)/g)) { let hash = match[1]; try { hash = decodeURIComponent(hash) } catch { /* reported below */ } if (!anchors.has(hash)) warnings.push('Internal heading link needs review: #' + hash) }
    return [...new Set(warnings)].map(message => ({ blockId: block.id, message }))
  })
}
