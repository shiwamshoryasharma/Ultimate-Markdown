import { Select } from '@/components/common/Select'
import { useEffect, useState, type ComponentProps } from 'react'
import { MarkdownPreview } from './MarkdownPreview'
import { useDocumentStore } from '@/stores/documentStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { hasFolderAccess } from '@/types/filesystem'
import { FolderHeart, ImagePlus } from 'lucide-react'
import { collectDocuments, type SourceDocument } from '@/services/conversion/model'
import './DocumentReader.css'

export function DocumentReader(props: ComponentProps<typeof MarkdownPreview>) {
  const [continuous, setContinuous] = useState(false)
  const [chain, setChain] = useState<SourceDocument[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const documents = useDocumentStore((state) => state.documents)
  const activeId = useDocumentStore((state) => state.activeId)
  const active = activeId ? documents.get(activeId) : undefined
  const current = active?.node.path === props.documentPath ? active : Array.from(documents.values()).find((doc) => doc.node.path === props.documentPath)
  const canContinue = hasFolderAccess(props.workspace) && !current?.node.standalone && !!props.workspace?.filesById.has(current?.id ?? '')
  const assets = current?.node.assetWorkspace ?? (current?.node.standalone ? null : props.workspace)
  const attachFolder = useWorkspaceStore((state) => state.attachAssetFolder)
  const linkOverrides = useWorkspaceStore((state) => state.linkOverrides)
  useEffect(() => {
    if (!continuous || !current || !canContinue) return
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      void collectDocuments(props.workspace, documents, current.id, 'linked-chain', [], linkOverrides)
        .then((result) => { if (!cancelled) { setChain(result.documents); setWarnings(result.warnings) } })
        .catch((error: unknown) => { if (!cancelled) setWarnings([error instanceof Error ? error.message : 'Cannot load linked documents.']) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 180)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [continuous, current, documents, props.workspace, canContinue, linkOverrides])
  return <div>
    {canContinue && <div className="document-reading-mode"><FolderHeart size={18} /><label>Reading <Select aria-label="Document reading mode" value={continuous ? 'continuous' : 'single'} onChange={(e) => setContinuous(e.target.value === 'continuous')}><option value="single">Single document</option><option value="continuous">Follow Next links</option></Select></label>{continuous && <span>{loading ? 'Loading…' : chain.length + ' documents'}</span>}</div>}
    {current?.node.standalone && <div className="document-asset-help"><ImagePlus size={22} /><span><strong>Images live beside your Markdown file.</strong><br />Connect the folder containing this file to load its images, or use Locate image below. Your text stays open.</span><button type="button" onClick={() => void attachFolder(current.id)}>{assets ? 'Change image folder' : 'Connect image folder'}</button></div>}
    {continuous && canContinue && warnings.length > 0 && <details className="document-reading-warnings"><summary>Linked document warnings</summary>{warnings.map((warning) => <p key={warning}>{warning}</p>)}</details>}
    <MarkdownPreview key={props.documentPath} {...props} workspace={assets} navigationWorkspace={canContinue ? props.workspace : null} />
    {continuous && canContinue && chain.filter((doc) => doc.path !== props.documentPath).map((doc) => <section key={doc.id}><div className="document-boundary">{doc.path}</div><MarkdownPreview {...props} workspace={doc.assetWorkspace ?? props.workspace} content={doc.content} documentPath={doc.path} /></section>)}
  </div>
}
