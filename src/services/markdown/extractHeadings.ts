import { slugify } from './slug'

export interface HeadingEntry {
  level: number
  text: string
  slug: string
}

/**
 * Line-scans raw markdown for ATX headings (`# ...` through `###### ...`),
 * skipping fenced code blocks. Deliberately not a full unified/remark parse —
 * this runs on every keystroke-driven TOC update, and a cheap regex scan
 * keeps it fast on large documents (see performance notes in SPEC.md).
 */
export function extractHeadings(markdown: string): HeadingEntry[] {
  const lines = markdown.split('\n')
  const counters = new Map<string, number>()
  const headings: HeadingEntry[] = []
  let inFence = false
  let fenceMarker = ''

  for (const line of lines) {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line)
    if (fenceMatch) {
      if (!inFence) {
        inFence = true
        fenceMarker = fenceMatch[1][0]
      } else if (fenceMatch[1][0] === fenceMarker) {
        inFence = false
      }
      continue
    }
    if (inFence) continue

    const headingMatch = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!headingMatch) continue

    const level = headingMatch[1].length
    const rawText = headingMatch[2]
    const text = rawText.replace(/[`*_~]/g, '').trim()
    if (!text) continue
    const slug = slugify(rawText, counters)
    headings.push({ level, text, slug })
  }

  return headings
}
