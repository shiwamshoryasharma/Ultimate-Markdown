import { Select } from '@/components/common/Select'
import { useRef, type ComponentPropsWithoutRef } from 'react'
import type { ExtraProps } from 'react-markdown'
import { ArrowLeft, ArrowRight, ArrowUpToLine, ArrowDownToLine, BookOpen, Check, FileQuestion, CornerDownRight } from 'lucide-react'
import { usePreviewContext } from './PreviewContext'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { resolveDocumentPath } from '@/services/markdown/documentLinks'
import { hasFolderAccess } from '@/types/filesystem'
import './DocumentNavigation.css'

export function DocumentNavigation({ node, ...props }: ComponentPropsWithoutRef<'nav'> & ExtraProps) {
  const {documentPath,navigationWorkspace:workspace,onNavigateToDocument} = usePreviewContext()
  const mappings=useWorkspaceStore(state=>state.linkOverrides)
  const root=useRef<HTMLElement>(null)
  const items=node?.data?.documentNavigation
  if(!items) return <nav {...props} />
  const files=Array.from(workspace?.filesById.values()??[]).sort((a,b)=>a.path.localeCompare(b.path,undefined,{numeric:true}))
  const canNavigate=hasFolderAccess(workspace)&&!!onNavigateToDocument
  const jump=(end:boolean)=>{
    const content=root.current?.closest('.markdown-content')
    const target=end?root.current:content
    target?.scrollIntoView({behavior:(document.documentElement.dataset.reducedMotion==='true'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)?'auto':'smooth',block:end?'end':'start'})
    if(end && content?.lastElementChild) content.lastElementChild.scrollIntoView({behavior:'auto',block:'end'})
  }
  return <nav ref={root} id={props.id} className="um-document-nav" aria-label="Document navigation">
    <div className="um-document-nav__header"><span className="um-document-nav__mark"><BookOpen size={20} aria-hidden="true" /></span><div><span className="um-document-nav__eyebrow">KEEP EXPLORING</span><h2>Document navigation</h2></div></div>
    <div className="um-document-nav__cards">
      {[...items].sort((a,b)=>a.direction===b.direction?0:a.direction==='previous'?-1:1).map(item=>{
        const original=resolveDocumentPath(documentPath,item.href)
        const mapped=original?mappings[`${documentPath}::${original}`]??original:null
        const target=files.find(file=>file.path===mapped)
        const stopped=mapped==='__stop__'
        const self=mapped===documentPath
        const ready=canNavigate&&!!target&&!self&&!stopped
        const name=target&&mapped!==original?target.name.replace(/\.(md|markdown)$/i,'').replace(/^\d+[\s._-]*/,'').replace(/[-_]/g,' ').replace(/^./,letter=>letter.toUpperCase()):item.label
        const Icon=stopped?Check:ready?item.direction==='previous'?ArrowLeft:ArrowRight:FileQuestion
        const hint=stopped?'You’ve reached the end':self?'You are here':ready?'Open document':!canNavigate?'Open its folder to navigate':'Linked file not found'
        return <button type="button" key={item.direction} className="um-document-nav__card" data-direction={item.direction} disabled={!ready} aria-label={`${item.direction==='previous'?'Previous':'Next'}: ${stopped?'End of manual':name}`} title={target?.path??item.href} onClick={()=>{if(ready&&target) onNavigateToDocument?.(target.path)}}>
          <span className="um-document-nav__arrow"><Icon size={22} aria-hidden="true" /></span><span className="um-document-nav__copy"><span className="um-document-nav__label">{item.direction==='previous'?'Previous page':'Up next'}</span><strong>{stopped?'End of manual':name}</strong><span className="um-document-nav__hint">{hint}</span></span>
        </button>
      })}
    </div>
    <div className="um-document-nav__tools">
      {canNavigate&&files.length>1&&<label className="um-document-nav__jump"><CornerDownRight size={16} aria-hidden="true" /><Select aria-label="Jump to document" value={documentPath} onChange={event=>onNavigateToDocument?.(event.target.value)}>{files.map(file=><option value={file.path} key={file.id}>{file.path}</option>)}</Select></label>}
      <div className="um-document-nav__scroll"><button type="button" onClick={()=>jump(false)}><ArrowUpToLine size={15} aria-hidden="true" />Top</button><button type="button" onClick={()=>jump(true)}><ArrowDownToLine size={15} aria-hidden="true" />Bottom</button></div>
    </div>
  </nav>
}
