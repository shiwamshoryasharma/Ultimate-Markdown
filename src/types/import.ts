export const BLOCK_TYPES = ['heading', 'paragraph', 'ordered-list', 'unordered-list', 'image', 'table', 'code', 'quote', 'callout', 'divider', 'caption'] as const
export type ImportBlockType = typeof BLOCK_TYPES[number]
export interface ImportBlock {
  id: string
  type: ImportBlockType
  markdown: string
  include: boolean
  removed: boolean
  sourceId?: string
  warnings: string[]
}
export interface ImportedDocument {
  id: string
  title: string
  source: { type: 'url' | 'docx' | 'html'; name: string; url?: string }
  originalHtml: string
  blocks: ImportBlock[]
  warnings: string[]
  extraction: string
  embeddedAssets?: Record<string,string>
}
export interface ImportSession {
  id: string
  documents: ImportedDocument[]
  revision: number
  reviewedRevision: number | null
}
export interface DocxMapping { style: string; target: ImportBlockType | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' }
export const DEFAULT_DOCX_MAPPINGS: DocxMapping[] = [
  { style: 'Title', target: 'h1' }, ...[1,2,3,4,5,6].map(n => ({ style: `Heading ${n}`, target: `h${n}` as DocxMapping['target'] })),
  { style: 'Normal', target: 'paragraph' }, { style: 'Quote', target: 'quote' }, { style: 'Code', target: 'code' }, { style: 'Caption', target: 'caption' },
]
export interface CrawlOptions { samePath: boolean; maxDepth: number; maxPages: number; includeImages: boolean; followLinks: boolean }
export interface DiscoveredPage { url: string; title: string; depth: number; selected: boolean; html?: string; error?: string }
