/** GitHub-style heading slug generator, with a shared counter map so repeated headings get -1, -2, ... suffixes consistently between the TOC extractor and the rendered preview headings. */
export function slugify(text: string, counters: Map<string, number>): string {
  let base = text
    .toLowerCase()
    .trim()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/[^\p{L}\p{N}\- ]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')

  if (!base) base = 'section'

  const count = counters.get(base) ?? 0
  counters.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}
