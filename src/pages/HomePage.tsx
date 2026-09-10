import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Check, Clock, Code2, FilePlus2, FileText, FolderOpen, Layers, Palette, PenLine, ShieldCheck, Table2, UploadCloud, Eye } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TopAppBar } from '@/components/layout/TopAppBar'
import { MarkdownPreview } from '@/components/preview/MarkdownPreview'
import { Toast } from '@/components/common/Toast'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useDocumentStore } from '@/stores/documentStore'
import { useRecentFilesStore } from '@/stores/recentFilesStore'
import { useConversionStore } from '@/stores/conversionStore'
import { useFileDrop } from '@/hooks/useFileDrop'
import type { OutputFormat } from '@/types/conversion'
import styles from './HomePage.module.css'

const EXAMPLE = '# A little clarity goes a long way\n\nTurn your notes into **something worth sharing**.\n\n## The plan\n\n- Write in Markdown\n- Choose your favourite style\n- Preview every page\n\n| Document | Ready for |\n| --- | --- |\n| Project notes | Your team |\n| Field guide | Your readers |\n\n> Good ideas deserve a clear page.'
const TOOLS: { format: OutputFormat; label: string; badge: string; description: string; color: string; icon: typeof FileText }[] = [
  { format: 'docx', label: 'Markdown to Word', badge: 'DOCX', description: 'Editable documents with headings, lists, and tables.', color: '#3875db', icon: FileText },
  { format: 'pdf', label: 'Markdown to PDF', badge: 'PDF', description: 'Lay out every page, then print or save a PDF.', color: '#df5c77', icon: BookOpen },
  { format: 'html', label: 'Markdown to HTML', badge: 'HTML', description: 'A styled web document you can save and share.', color: '#d78726', icon: Code2 },
  { format: 'xlsx', label: 'Markdown to Excel', badge: 'XLSX', description: 'Turn each Markdown table into a worksheet.', color: '#259b7d', icon: Table2 },
  { format: 'txt', label: 'Markdown to Text', badge: 'TXT', description: 'Keep the words. Export clean, readable plain text.', color: '#9763cc', icon: FileText },
]

export function HomePage() {
  const navigate = useNavigate()
  const ws = useWorkspaceStore()
  const recent = useRecentFilesStore((state) => state.entries)
  const [example, setExample] = useState(EXAMPLE)
  const [message, setMessage] = useState('')
  const open = async (folder = false) => {
    const before = useWorkspaceStore.getState().workspace
    const beforeId = useDocumentStore.getState().activeId
    await (folder ? ws.openFolder() : ws.openFile())
    if (useWorkspaceStore.getState().workspace !== before || useDocumentStore.getState().activeId !== beforeId) navigate('/workspace?reader=1')
  }
  const create = (content?: string) => {
    const store = useDocumentStore.getState()
    const id = store.createNewDocument()
    store.updateContent(id, content ?? '')
    navigate('/workspace')
  }
  const convert = (format: OutputFormat) => { useConversionStore.getState().update({ format }); navigate('/converter') }
  const { dragActive, dragHandlers } = useFileDrop(async (data) => {
    await ws.openDropped(data)
    if (!useWorkspaceStore.getState().error) navigate('/workspace?reader=1')
  })
  const openRecent = (path: string) => {
    const store = useDocumentStore.getState()
    const doc = Array.from(store.documents.values()).find((entry) => entry.node.path === path)
    if (doc) { store.setActiveDocument(doc.id); navigate('/workspace?reader=1') }
    else setMessage('Choose Open Markdown to reopen this document. Recent history keeps filenames, not document contents.')
  }
  return <AppShell topBar={<TopAppBar />}><div className={styles.root} {...dragHandlers}><div className={styles.scroll}>
    <section className={styles.hero}>
      <div><span className={styles.eyebrow}><PenLine size={14} /> YOUR WORDS. BEAUTIFULLY PRESENTED.</span><h1>From Markdown<br />to <em>ready to share.</em></h1><p>Read, write, and turn your documents into Word, PDF, and more. A little less formatting. A lot more creating.</p>
        <div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void open()} disabled={ws.status === 'loading'}><UploadCloud size={19} />Open Markdown</button><button className={styles.secondary} type="button" onClick={() => void open(true)} disabled={ws.status === 'loading'}><FolderOpen size={19} />Open folder</button></div>
        <div className={styles.helper}>Folder mode includes local images and follows Next links.</div><div className={styles.privacy}><ShieldCheck size={17} />Processed in your browser · No account needed</div>
      </div>
      <div className={styles.heroArt} aria-label="Illustration of Markdown becoming a styled document"><div className={styles.sourceCard}><span><Code2 size={14} /> NOTES.MD</span><code><b># A fresh perspective</b><br /><br />Ideas become **stories**.<br /><br /><b>## Make it yours</b><br />- Choose a theme<br />- Add a little colour<br />- Share your words</code></div><span className={styles.flowArrow}><ArrowRight /></span><div className={styles.documentCard}><span className={styles.documentTag}>THE EVERYDAY EDITION</span><h2>A fresh<br />perspective.</h2><p>Ideas become <strong>stories.</strong></p><hr /><h3>Make it yours</h3><p><Check />Choose a theme</p><p><Check />Add a little colour</p><p><Check />Share your words</p><div className={styles.swatches}><i /><i /><i /><i /></div></div><div className={styles.floatingTag}><Palette size={16} />Your style, on every page</div></div>
    </section>
    {(ws.error || message) && <Toast message={ws.error || message} onDismiss={() => { ws.clearError(); setMessage('') }} />}
    <section className={styles.quick} aria-label="Workspace actions"><button type="button" onClick={() => create()}><span data-tone="purple"><FilePlus2 /></span><strong>Start writing</strong><small>A fresh document</small><ArrowRight /></button><button type="button" onClick={() => navigate('/workspace')}><span data-tone="blue"><PenLine /></span><strong>Continue editing</strong><small>Back to your workspace</small><ArrowRight /></button><button type="button" onClick={() => navigate('/workspace?reader=1')}><span data-tone="green"><BookOpen /></span><strong>Just read</strong><small>A focused view of your words</small><ArrowRight /></button></section>
    <section className={styles.section}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ONE WORKSPACE, MANY POSSIBILITIES</span><h2>Where will your words go?</h2></div><p>Choose a format to get started.</p></div><div className={styles.tools}>{TOOLS.map(({ format, label, badge, description, color, icon: Icon }) => <button key={format} type="button" className={styles.tool} style={{ '--tool-color': color } as CSSProperties} onClick={() => convert(format)}><span className={styles.fileIcon}><Icon /><b>{badge}</b><i /><i /></span><h3>{label}</h3><p>{description}</p><span className={styles.try}>Convert to {badge}<ArrowRight size={15} /></span></button>)}</div></section>
    <section className={styles.section}><div className={styles.centerHeading}><span className={styles.eyebrow}>SEE IT BEFORE YOU SHARE IT</span><h2>A simple idea. A polished document.</h2><p>Try this example or paste your own Markdown. The preview updates as you type.</p></div><div className={styles.demo}><div><div className={styles.demoHeading}><Code2 size={17} />Markdown <span>Editable example</span></div><textarea aria-label="Try Markdown" spellCheck={false} value={example} onChange={(e) => setExample(e.target.value)} /></div><div><div className={styles.demoHeading}><Eye size={17} />Live preview</div><div className={styles.demoPreview}><MarkdownPreview content={example} documentPath="example.md" workspace={null} /></div></div></div><div className={styles.demoActions}><button className={styles.secondary} type="button" onClick={() => create(example)}><PenLine size={16} />Open in editor</button><button className={styles.primary} type="button" onClick={() => { const store = useDocumentStore.getState(); const id = store.createNewDocument(); store.updateContent(id, example); convert('docx') }}>Style &amp; export<ArrowRight size={16} /></button></div></section>
    <section className={styles.section}><div className={styles.centerHeading}><h2>Less setup. More possibilities.</h2><p>Useful tools for everyday documents, together in one place.</p></div><div className={styles.features}>{[
      { icon: Eye, title: 'Preview every page', text: 'Check paper size, spacing, and page breaks before saving your PDF.', tone: 'blue' },
      { icon: Palette, title: 'Make it feel like yours', text: 'Pick a theme, warm up the page colour, and fine-tune your typography.', tone: 'purple' },
      { icon: Layers, title: 'One manual, in order', text: 'Open a folder and follow its Next links into one combined export.', tone: 'green' },
      { icon: FileText, title: 'Words that stay editable', text: 'DOCX keeps paragraphs, lists, and tables ready for the next revision.', tone: 'blue' },
      { icon: FolderOpen, title: 'Bring your documents', text: 'Open a file, select a folder, drag and drop, or paste your Markdown.', tone: 'amber' },
      { icon: ShieldCheck, title: 'Your files stay with you', text: 'Conversion runs locally. Source files change only when you choose Save.', tone: 'green' },
    ].map(({ icon: Icon, title, text, tone }) => <article key={title}><div className={styles.featureVisual} data-tone={tone}><Icon /><span><i /><i /><i /></span></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className={styles.section}><div className={styles.sectionHeading}><h2><Clock size={21} />Recently opened</h2><span className={styles.helper}>On this device</span></div>{recent.length ? <div className={styles.recents}>{recent.map((entry) => <button type="button" key={entry.id} onClick={() => openRecent(entry.path)}><FileText /><span><strong>{entry.name}</strong><small>{entry.path}</small></span><ArrowRight size={16} /></button>)}</div> : <div className={styles.recentEmpty}>Your recently opened documents will appear here.</div>}</section>
    <footer className={styles.footer}><span>Ultimate Markdown</span><span>Write simply. Share beautifully.</span><ShieldCheck size={18} /></footer>
    </div>{dragActive && <div className={styles.dropOverlay}><UploadCloud size={46} /><h2>Drop your Markdown or folder here</h2></div>}</div></AppShell>
}
