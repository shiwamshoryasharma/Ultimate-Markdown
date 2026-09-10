import { Link2 } from 'lucide-react'
import type { Workspace } from '@/types/filesystem'
import { type MissingDocumentLink, STOP_LINK } from '@/services/conversion/model'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import styles from './LinkRepairs.module.css'

export function LinkRepairs({ missing, workspace }: { missing: MissingDocumentLink[]; workspace: Workspace | null }) {
  const overrides = useWorkspaceStore((state) => state.linkOverrides)
  const setOverride = useWorkspaceStore((state) => state.setLinkOverride)
  const links = new Map(missing.map((link) => [`${link.from}::${link.target}`, link]))
  for (const key of Object.keys(overrides)) { const [from, target] = key.split('::'); links.set(key, { from, target }) }
  if (!links.size) return null
  return <section className={styles.root} aria-label="Repair document links"><h3><Link2 size={18} />{missing.length ? 'Choose where the manual continues' : 'Document link mappings'}</h3><p>These filenames do not match files in this folder. Choose the intended next document or end the chain. Source Markdown stays unchanged.</p>
    {Array.from(links, ([key, link]) => <label key={key}><strong>{link.from}</strong><span>Next: {link.target}</span><select aria-label={`Replacement for ${link.target} from ${link.from}`} value={overrides[key] ?? ''} onChange={(e) => setOverride(link.from, link.target, e.target.value)}><option value="">Choose a replacement…</option><option value={STOP_LINK}>End the chain here</option>{Array.from(workspace?.filesById.values() ?? []).filter((node) => node.path !== link.from).map((node) => <option key={node.id} value={node.path}>{node.path}</option>)}</select></label>)}
  </section>
}
