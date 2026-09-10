export interface DocumentStats {
  words: number
  characters: number
  lines: number
  headings: number
  links: number
  images: number
  tables: number
  codeBlocks: number
  readingTimeMinutes: number
}

/** All figures are computed directly from the loaded document text — never placeholder/fake values. */
export function computeDocumentStats(markdown: string): DocumentStats {
  const characters = markdown.length
  const lines = markdown.length === 0 ? 0 : markdown.split('\n').length

  // Code content shouldn't inflate prose word count.
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/~~~[\s\S]*?~~~/g, ' ')
  const words = (withoutCode.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length

  const headings = (markdown.match(/^\s{0,3}#{1,6}\s+.+$/gm) ?? []).length
  const fenceLines = markdown.match(/^\s{0,3}(```+|~~~+)/gm) ?? []
  const codeBlocks = Math.floor(fenceLines.length / 2)
  const images = (markdown.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length
  const links = (markdown.match(/(?<!!)\[[^\]]*\]\([^)]*\)/g) ?? []).length
  const tables = (markdown.match(/^\s{0,3}\|.*\|\s*\r?\n\s{0,3}\|[\s:|-]+\|\s*$/gm) ?? []).length

  const readingTimeMinutes = words === 0 ? 0 : Math.max(1, Math.round(words / 200))

  return { words, characters, lines, headings, links, images, tables, codeBlocks, readingTimeMinutes }
}
