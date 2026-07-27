import type {Getter} from 'jotai'
import type {ExplorerLocation} from '../Dashboard.js'
import type {
  DashboardEntry,
  DashboardRoot,
  DashboardWorkspace
} from '../Dashboard.js'

export interface ExplorerPageData {
  type: 'explorer'
  root: DashboardRoot
  items: Array<DashboardEntry>
}

export interface EntryLookup {
  entry(id: string): DashboardEntry
}

export async function loadEntries(
  get: Getter,
  entries: Array<DashboardEntry>,
  signal: AbortSignal
) {
  await Promise.all(entries.map(entry => get(entry.readyState)))
  signal.throwIfAborted()
}

export async function loadTree(
  get: Getter,
  lookup: EntryLookup,
  workspace: DashboardWorkspace,
  rootIds: Array<string>,
  locale: string | null,
  forcedExpanded: Array<string>,
  signal: AbortSignal
) {
  const expanded = new Set(get(workspace.tree.expandedKeys))
  for (const id of forcedExpanded) expanded.add(id)
  const loaded = new Set<string>()
  async function load(ids: Array<string>): Promise<void> {
    await Promise.all(
      ids.map(async id => {
        if (loaded.has(id)) return
        loaded.add(id)
        const entry = lookup.entry(id)
        const ready = await get(entry.readyState)
        signal.throwIfAborted()
        if (!ready.data || !expanded.has(id)) return
        const childIds = await get(ready.data.childrenFor(locale))
        await load(childIds)
      })
    )
  }
  await load(rootIds)
}

export async function loadExplorerPage(
  get: Getter,
  root: DashboardRoot,
  location: ExplorerLocation,
  locale: string | null,
  signal: AbortSignal
): Promise<ExplorerPageData> {
  const items = await get(root.explorer.itemsAt(location, locale))
  await loadEntries(get, items, signal)
  return {type: 'explorer', root, items}
}
