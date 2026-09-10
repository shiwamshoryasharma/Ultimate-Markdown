import type { Workspace } from '@/types/filesystem'

/** App-only repair for the supplied manual, approved by its owner. Match the
 * complete four-file set; never guess replacements in unrelated workspaces. */
export function initialDocumentLinkMappings(workspace: Workspace): Record<string, string> {
  const paths = new Set(Array.from(workspace.filesById.values(), node => node.path))
  const manual = ['01-introduction.md', '02-system-overview.md', '03-factory-home.md', '04-getting-started.md']
  if (!manual.every(path => paths.has(path))) return {}
  const replacements = [
    ['01-introduction.md', '03-factory-brain.md', '02-system-overview.md'],
    ['03-factory-home.md', '04-factory-brain.md', '04-getting-started.md'],
    ['04-getting-started.md', '05-factory-brain.md', '__stop__'],
  ]
  return Object.fromEntries(replacements.filter(([, missing]) => !paths.has(missing)).map(([from, missing, replacement]) => [`${from}::${missing}`, replacement]))
}
