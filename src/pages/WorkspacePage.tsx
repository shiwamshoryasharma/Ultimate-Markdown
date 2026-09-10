import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { EditorView } from '@codemirror/view'
import {
  BookOpen,
  FilePlus2,
  FileText,
  FolderOpen,
  List as ListIcon,
  PanelLeft,
  PanelRight,
  Rows3,
  Save,
  SquareSplitHorizontal,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TopAppBar } from '@/components/layout/TopAppBar'
import { StatusBar } from '@/components/layout/StatusBar'
import { Resizer } from '@/components/layout/Resizer'
import { ExplorerPanel } from '@/components/explorer/ExplorerPanel'
import { DocumentTabs } from '@/components/editor/DocumentTabs'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { MarkdownEditor } from '@/components/editor/MarkdownEditor'
import { DocumentReader } from '@/components/preview/DocumentReader'
import { TocPanel } from '@/components/toc/TocPanel'
import { IconButton } from '@/components/common/IconButton'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { Toast } from '@/components/common/Toast'
import { BottomSheet } from '@/components/common/BottomSheet'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useDocumentStore } from '@/stores/documentStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useViewport } from '@/hooks/useViewport'
import { useFileDrop } from '@/hooks/useFileDrop'
import { computeDocumentStats } from '@/services/markdown/documentStats'
import { downloadTextFile } from '@/utils/downloadFile'
import styles from './WorkspacePage.module.css'

type ViewMode = 'split' | 'edit' | 'preview'
type MobileTab = 'files' | 'edit' | 'preview'

export function WorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const viewport = useViewport()

  const workspace = useWorkspaceStore((state) => state.workspace)
  const wsError = useWorkspaceStore((state) => state.error)
  const clearWsError = useWorkspaceStore((state) => state.clearError)
  const openFolder = useWorkspaceStore((state) => state.openFolder)
  const openFile = useWorkspaceStore((state) => state.openFile)
  const openDropped = useWorkspaceStore((state) => state.openDropped)

  const documents = useDocumentStore((state) => state.documents)
  const activeId = useDocumentStore((state) => state.activeId)
  const updateContent = useDocumentStore((state) => state.updateContent)
  const createNewDocument = useDocumentStore((state) => state.createNewDocument)
  const saveDocument = useDocumentStore((state) => state.saveDocument)
  const saveDocumentAs = useDocumentStore((state) => state.saveDocumentAs)
  const saving = useDocumentStore((state) => state.saving)
  const docError = useDocumentStore((state) => state.error)
  const clearDocError = useDocumentStore((state) => state.clearError)
  const hasAnyUnsaved = useDocumentStore((state) => state.hasAnyUnsaved)
  const openDocument = useDocumentStore((state) => state.openDocument)

  const editorSettings = useSettingsStore((state) => state.editor)
  const previewSettings = useSettingsStore((state) => state.preview)

  const activeDocument = activeId ? documents.get(activeId) : null

  const [explorerCollapsed, setExplorerCollapsed] = useState(() => viewport !== 'desktop')
  const [explorerWidth, setExplorerWidth] = useState(280)
  const [tocOpen, setTocOpen] = useState(false)
  const [editorSplit, setEditorSplit] = useState(50)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [mobileTab, setMobileTab] = useState<MobileTab>('edit')
  const [readerMode, setReaderMode] = useState(() => searchParams.get('reader') === '1')

  const editorViewRef = useRef<EditorView | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)

  const exitReaderMode = useCallback(() => {
    setReaderMode(false)
    if (searchParams.get('reader')) {
      const next = new URLSearchParams(searchParams)
      next.delete('reader')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleContentChange = useCallback(
    (value: string) => {
      if (activeId) updateContent(activeId, value)
    },
    [activeId, updateContent],
  )

  const handleSave = useCallback(async () => {
    if (!activeId || !activeDocument) return
    const result = await saveDocument(activeId)
    if (result === 'unsupported') {
      downloadTextFile(activeDocument.content, activeDocument.node.name)
    }
  }, [activeId, activeDocument, saveDocument])

  const handleSaveAs = useCallback(async () => {
    if (!activeId || !activeDocument) return
    const result = await saveDocumentAs(activeId)
    if (result === 'unsupported') {
      downloadTextFile(activeDocument.content, activeDocument.node.name)
    }
  }, [activeId, activeDocument, saveDocumentAs])

  const handleNavigateToDocument = useCallback(
    (path: string) => {
      const node = workspace?.filesById.get(path)
      if (node) void openDocument(node)
    },
    [workspace, openDocument],
  )

  // Keyboard shortcuts: Ctrl/Cmd+S save, Ctrl/Cmd+N new document. Full shortcut set + command palette land in a later phase.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMod = event.ctrlKey || event.metaKey
      if (!isMod) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        if (event.shiftKey) void handleSaveAs()
        else void handleSave()
      } else if (key === 'n' && !event.shiftKey) {
        event.preventDefault()
        createNewDocument()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave, handleSaveAs, createNewDocument])

  // Warn before closing the tab/browser if any open document has unsaved edits.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (hasAnyUnsaved()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasAnyUnsaved])

  const { dragActive, dragHandlers } = useFileDrop(async (dataTransfer) => {
    await openDropped(dataTransfer)
  })

  const stats = useMemo(
    () => (activeDocument ? computeDocumentStats(activeDocument.content) : null),
    [activeDocument],
  )

  const handleExplorerResize = useCallback((deltaX: number) => {
    setExplorerWidth((width) => Math.min(480, Math.max(200, width + deltaX)))
  }, [])

  const handleSplitResize = useCallback((deltaX: number) => {
    setEditorSplit((split) => {
      const containerWidth = previewScrollRef.current?.parentElement?.clientWidth ?? 1000
      const deltaPercent = (deltaX / containerWidth) * 100
      return Math.min(80, Math.max(20, split + deltaPercent))
    })
  }, [])

  const isDirty = activeId ? activeDocument?.content !== activeDocument?.originalContent : false

  const topBarActions = (
    <>
      {viewport === 'desktop' && (
        <IconButton
          icon={<PanelLeft />}
          label={explorerCollapsed ? 'Show explorer' : 'Hide explorer'}
          active={!explorerCollapsed}
          onClick={() => setExplorerCollapsed((v) => !v)}
        />
      )}
      {viewport !== 'mobile' && (
        <IconButton icon={<PanelRight />} label={tocOpen ? 'Hide table of contents' : 'Show table of contents'} active={tocOpen} onClick={() => setTocOpen((v) => !v)} />
      )}
      {viewport !== 'mobile' && !readerMode && (
        <IconButton
          icon={<SquareSplitHorizontal />}
          label="Toggle split view"
          active={viewMode === 'split'}
          onClick={() => setViewMode((mode) => (mode === 'split' ? 'edit' : 'split'))}
        />
      )}
      <IconButton icon={<BookOpen />} label={readerMode ? 'Exit reader mode' : 'Reader mode'} active={readerMode} onClick={() => (readerMode ? exitReaderMode() : setReaderMode(true))} />
      {activeDocument && !readerMode && (
        <Button variant="filled" size="sm" icon={<Save />} onClick={() => void handleSave()} disabled={saving || !isDirty}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      )}
    </>
  )

  const statusLeft = stats && activeDocument ? (
    <>
      <span>{activeDocument.node.path}</span>
      <span>{stats.words} words</span>
      <span>{stats.characters} characters</span>
      <span>{stats.readingTimeMinutes} min read</span>
    </>
  ) : (
    <span>No document selected</span>
  )

  const statusRight = workspace ? (
    <span>{workspace.rootName} · {workspace.filesById.size} file{workspace.filesById.size === 1 ? '' : 's'}</span>
  ) : (
    <span>No folder open</span>
  )

  if (readerMode && activeDocument) {
    return (
      <AppShell topBar={<TopAppBar actions={topBarActions} />}>
        <div className={styles.readerRoot}>
          <div className={styles.readerScroll} ref={previewScrollRef}>
            <DocumentReader
              content={activeDocument.content}
              documentPath={activeDocument.node.path}
              workspace={workspace}
              onNavigateToDocument={handleNavigateToDocument}
              fontSize={previewSettings.fontSize}
              contentWidth={previewSettings.contentWidth}
            />
          </div>
          {tocOpen && (
            <div className={styles.readerToc}>
              <TocPanel content={activeDocument.content} scrollContainerRef={previewScrollRef} />
            </div>
          )}
        </div>
      </AppShell>
    )
  }

  const showExplorer = viewport === 'mobile' ? mobileTab === 'files' : !explorerCollapsed
  const showEditorPane = viewport === 'mobile' ? mobileTab === 'edit' : viewMode !== 'preview'
  const showPreviewPane = viewport === 'mobile' ? mobileTab === 'preview' : viewMode !== 'edit'
  const showSplitResizer = viewport !== 'mobile' && viewMode === 'split'

  return (
    <AppShell
      topBar={<TopAppBar actions={topBarActions} />}
      statusBar={<StatusBar left={statusLeft} right={statusRight} />}
    >
      <div className={styles.page}>
      <div className={styles.workspace} {...dragHandlers}>
        {showExplorer && viewport !== 'mobile' && (
          <>
            <div className={styles.explorerContainer} style={{ width: explorerWidth }}>
              <ExplorerPanel />
            </div>
            <Resizer onResize={handleExplorerResize} ariaLabel="Resize file explorer" />
          </>
        )}
        {showExplorer && viewport === 'mobile' && (
          <div className={styles.mobilePane}>
            <ExplorerPanel />
          </div>
        )}

        {viewport !== 'mobile' && (
          <div className={styles.center}>
            <DocumentTabs />
            {!activeDocument ? (
              <EmptyState
                icon={<FileText />}
                title="No document selected"
                description="Open a file or folder, or start a new document, to begin."
                action={
                  <div className={styles.emptyActions}>
                    <Button variant="tonal" icon={<FolderOpen />} onClick={() => void openFolder()}>
                      Open Folder
                    </Button>
                    <Button variant="tonal" icon={<FileText />} onClick={() => void openFile()}>
                      Open File
                    </Button>
                    <Button variant="filled" icon={<FilePlus2 />} onClick={() => createNewDocument()}>
                      New Document
                    </Button>
                  </div>
                }
              />
            ) : (
              <>
                <EditorToolbar getView={() => editorViewRef.current} />
                <div className={styles.splitArea}>
                  {showEditorPane && (
                    <div className={styles.editorPane} style={{ width: viewMode === 'split' ? `${editorSplit}%` : '100%' }}>
                      <MarkdownEditor
                        key={activeId}
                        initialValue={activeDocument.content}
                        onChange={handleContentChange}
                        settings={editorSettings}
                        onViewReady={(view) => {
                          editorViewRef.current = view
                        }}
                      />
                    </div>
                  )}
                  {showSplitResizer && <Resizer onResize={handleSplitResize} ariaLabel="Resize editor and preview" />}
                  {showPreviewPane && (
                    <div
                      className={styles.previewPane}
                      ref={previewScrollRef}
                      style={{ width: viewMode === 'split' ? `${100 - editorSplit}%` : '100%' }}
                    >
                      <DocumentReader
                        content={activeDocument.content}
                        documentPath={activeDocument.node.path}
                        workspace={workspace}
                        onNavigateToDocument={handleNavigateToDocument}
                        fontSize={previewSettings.fontSize}
                        contentWidth={previewSettings.contentWidth}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {viewport === 'mobile' && mobileTab === 'edit' && (
          <div className={styles.mobilePane}>
            {!activeDocument ? (
              <EmptyState icon={<FileText />} title="No document selected" description="Open a file from the Files tab, or start a new one." />
            ) : (
              <>
                <DocumentTabs />
                <EditorToolbar getView={() => editorViewRef.current} />
                <div className={styles.editorPane} style={{ width: '100%', flex: 1 }}>
                  <MarkdownEditor
                    key={activeId}
                    initialValue={activeDocument.content}
                    onChange={handleContentChange}
                    settings={editorSettings}
                    onViewReady={(view) => {
                      editorViewRef.current = view
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {viewport === 'mobile' && mobileTab === 'preview' && (
          <div className={styles.mobilePane}>
            {!activeDocument ? (
              <EmptyState icon={<FileText />} title="Nothing to preview" description="Open or write a document first." />
            ) : (
              <>
                <div className={styles.previewPane} ref={previewScrollRef} style={{ width: '100%' }}>
                  <DocumentReader
                    content={activeDocument.content}
                    documentPath={activeDocument.node.path}
                    workspace={workspace}
                    onNavigateToDocument={handleNavigateToDocument}
                    fontSize={previewSettings.fontSize}
                    contentWidth={previewSettings.contentWidth}
                  />
                </div>
                <IconButton
                  className={styles.mobileTocFab}
                  icon={<ListIcon />}
                  label="Table of contents"
                  variant="filled"
                  size="lg"
                  onClick={() => setTocOpen(true)}
                />
              </>
            )}
          </div>
        )}

        {viewport !== 'mobile' && tocOpen && activeDocument && (
          <div className={styles.tocContainer}>
            <TocPanel content={activeDocument.content} scrollContainerRef={previewScrollRef} />
          </div>
        )}

        {dragActive && (
          <div className={styles.dropOverlay} aria-hidden="true">
            <div className={styles.dropCard}>
              <FolderOpen className={styles.dropIcon} />
              <p>Drop to add to this workspace</p>
            </div>
          </div>
        )}

        {(wsError || docError) && (
          <div className={styles.toastStack}>
            {wsError && <Toast message={wsError} onDismiss={clearWsError} />}
            {docError && <Toast message={docError} onDismiss={clearDocError} />}
          </div>
        )}
      </div>

      {viewport === 'mobile' && (
        <nav className={styles.mobileTabs} aria-label="Workspace sections">
          <button type="button" className={mobileTab === 'files' ? styles.mobileTabActive : styles.mobileTab} onClick={() => setMobileTab('files')}>
            <FolderOpen />
            <span>Files</span>
          </button>
          <button type="button" className={mobileTab === 'edit' ? styles.mobileTabActive : styles.mobileTab} onClick={() => setMobileTab('edit')}>
            <Rows3 />
            <span>Edit</span>
          </button>
          <button type="button" className={mobileTab === 'preview' ? styles.mobileTabActive : styles.mobileTab} onClick={() => setMobileTab('preview')}>
            <BookOpen />
            <span>Preview</span>
          </button>
        </nav>
      )}
      </div>

      {viewport === 'mobile' && activeDocument && (
        <BottomSheet open={tocOpen} title="Table of contents" onClose={() => setTocOpen(false)}>
          <TocPanel content={activeDocument.content} scrollContainerRef={previewScrollRef} />
        </BottomSheet>
      )}
    </AppShell>
  )
}
