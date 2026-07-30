import {useAtomValue} from '../AtomHooks.js'
import {atom, useSetAtom} from 'jotai'
import {useMemo} from 'react'
import type {Key, Selection} from 'react-aria-components'
import type {EntryAtoms} from '../atoms/entry.js'
import type {ExplorerAtoms, ExplorerOptions} from '../atoms/explorer.js'
import {type PreparedTree, TreeAtoms, workspaceAtoms} from '../atoms/config.js'
import {swr} from '../atoms/utils.js'
import {ExplorerBody} from './Explorer.js'
import {ExplorerModalContent, ExplorerModalNavigation} from './ExplorerModal.js'
import {SidebarTreeExplorer} from './SidebarTree.js'

export interface ExplorerPickerContentProps {
  explorer: ExplorerAtoms
  items: Array<EntryAtoms>
  navigationLabel: string
  options: ExplorerOptions
  preparedTree: PreparedTree | undefined
  tree: TreeAtoms
}

export function ExplorerPickerContent({
  explorer,
  items,
  navigationLabel,
  options,
  preparedTree,
  tree
}: ExplorerPickerContentProps) {
  const root = useAtomValue(explorer.root)
  const location = useAtomValue(explorer.location)
  const view = useAtomValue(explorer.view)
  const navigate = useSetAtom(explorer.navigate)
  const enableNavigation = options.enableNavigation ?? true
  const selectedKeys = useMemo(
    () =>
      location.parentId ? new Set<Key>([location.parentId]) : new Set<Key>(),
    [location.parentId]
  )

  function onRootPress() {
    void navigate(current => ({...current, parentId: undefined}))
  }

  function onSelectionChange(keys: Selection) {
    if (keys === 'all') return
    const [selected] = keys
    void navigate(current => ({
      ...current,
      parentId: selected ? String(selected) : undefined
    }))
  }

  return (
    <ExplorerModalContent>
      {enableNavigation && view === 'card' && root && preparedTree && (
        <ExplorerModalNavigation>
          <SidebarTreeExplorer
            ariaLabel={navigationLabel}
            root={root}
            rootSelected={!location.parentId}
            selectedKeys={selectedKeys}
            selectedLocale={explorer.selectedLocale}
            prepared={preparedTree}
            tree={tree}
            onRootPress={onRootPress}
            onSelectionChange={onSelectionChange}
          />
        </ExplorerModalNavigation>
      )}
      <ExplorerBody explorer={explorer} items={items} />
    </ExplorerModalContent>
  )
}

export function createExplorerPickerSnapshot(
  explorer: ExplorerAtoms,
  workspace: string
) {
  const tree = new TreeAtoms(workspaceAtoms(workspace))
  const snapshot = swr(
    atom(async get => {
      const explorerSnapshot = await get(explorer.snapshot)
      const root = get(explorer.root)
      const preparedTree = root
        ? await tree.prepare(get, root, get(explorer.selectedLocale))
        : undefined
      return {
        items: explorerSnapshot.items,
        preparedTree
      }
    })
  )
  return {snapshot, tree}
}
