import {atom} from 'jotai'
import {MissingEntryError} from './Contracts.js'
import {type EntryDataState, entryAtoms} from './EntryAtoms.js'
import {routeAtom} from './NavigationAtoms.js'
import {pageAtom} from './PageAtoms.js'
import {
  selectedRootAtom,
  selectedWorkspaceAtom
} from './SelectionAtoms.js'
import {createThemeAtom} from './ThemeAtom.js'
import {
  currentWorkspaceAtom,
  workspaceAtoms
} from './WorkspaceAtoms.js'
import type {Root} from './RootAtoms.js'

export type FocusedItem =
  | {entry: EntryDataState}
  | {root: Root}
  | {missingEntry: string; root: Root}
  | {missingRoot: string; root: Root}
  | null

const initialContentLoadedAtom = atom(false)

const initialContentResourceAtom = atom(async get => {
  if (get(initialContentLoadedAtom)) return true
  await get(pageAtom)
  const workspace = get(currentWorkspaceAtom)
  if (!workspace) return true
  const roots = get(workspace.roots)
  if (roots.length === 0) return true
  await get(workspace.tree.items)
  return true
})

export const initialContentAvailableAtom = Object.assign(
  atom(
    get => get(initialContentResourceAtom),
    async (get, set) => {
      await get(initialContentResourceAtom)
      set(initialContentLoadedAtom, true)
    }
  ),
  {
    onMount(load: () => void) {
      load()
    }
  }
)

export const focusedAtom = atom(
  (get): FocusedItem | Promise<FocusedItem> => {
    const {page} = get(routeAtom)
    if (page === 'users') return null
    const workspace = get(selectedWorkspaceAtom)
    const root = get(selectedRootAtom)
    const {root: routeRoot, entry} = get(routeAtom)
    const focusedRoot = (): FocusedItem => {
      if (!workspace) return null
      if (root) return {root: workspaceAtoms(workspace).root(root)}
      return null
    }
    const missingEntry = (error: unknown): FocusedItem => {
      if (!(error instanceof MissingEntryError)) throw error
      if (workspace && root) {
        return {
          missingEntry: entry!,
          root: workspaceAtoms(workspace).root(root)
        }
      }
      throw new Error(`Entry "${entry}" not found`)
    }
    const focusedEntry = (data: EntryDataState): FocusedItem => {
      return get(data.view) === 'edit' ? {entry: data} : focusedRoot()
    }
    if (workspace && routeRoot && routeRoot !== root) {
      if (!root) return null
      return {
        missingRoot: routeRoot,
        root: workspaceAtoms(workspace).root(root)
      }
    }
    if (entry)
      try {
        const {data, error} = get(entryAtoms(entry).data)
        if (error) return missingEntry(error)
        if (data) return focusedEntry(data)
        return null
      } catch (error) {
        return missingEntry(error)
      }
    return focusedRoot()
  }
)

export const themeAtom = createThemeAtom()
