import {rootAtoms} from '#/dashboard/atoms/root.js'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {startTransition, useMemo} from 'react'
import type {Key, Selection} from 'react-aria-components'
import type {DashboardExplorer} from '../atoms/explorer.js'
import {dispense} from '../atoms/utils.js'
import {ExplorerBody} from './Explorer.js'
import {ExplorerModalContent, ExplorerModalNavigation} from './ExplorerModal.js'
import {SidebarTreeExplorer} from './SidebarTree.js'

export const explorerTree = dispense(
  (
    root: ReturnType<typeof rootAtoms>,
    explorer: DashboardExplorer,
    locale: string | null
  ) =>
    root.createTree(
      locale,
      atom(get => {
        const parentId = get(explorer.location).parentId
        return parentId ? new Set<Key>([parentId]) : new Set<Key>()
      })
    )
)

const explorerTreeReady = dispense((tree: ReturnType<typeof explorerTree>) => {
  const ready = unwrap(tree.ready, previous => previous)
  return atom(get => get(ready) ?? get(tree.ready))
})

export interface ExplorerPickerContentProps {
  explorer: DashboardExplorer
  navigationLabel: string
  options: {pickChildren?: boolean}
}

export function ExplorerPickerContent({
  explorer,
  navigationLabel,
  options
}: ExplorerPickerContentProps) {
  const location = useAtomValue(explorer.location)
  const view = useAtomValue(explorer.view)
  const selectedLocale = useAtomValue(explorer.selectedLocale)
  const page = useAtomValue(explorer.page(selectedLocale))
  const readyItems = useMemo(() => atom(page.items), [page.items])
  const setLocation = useSetAtom(explorer.location)
  const root = location.root
    ? rootAtoms(location.workspace, location.root)
    : undefined
  const showNavigation = !options.pickChildren

  function onRootPress() {
    startTransition(() => {
      setLocation(current => ({...current, parentId: undefined}))
    })
  }

  function onSelectionChange(keys: Selection) {
    if (keys === 'all') return
    const [selected] = keys
    startTransition(() => {
      setLocation(current => ({
        ...current,
        parentId: selected ? String(selected) : undefined
      }))
    })
  }

  return (
    <ExplorerModalContent>
      {showNavigation &&
        view === 'card' &&
        page.resultMode === 'browse' &&
        !page.searchesEverything &&
        root && (
          <ExplorerPickerNavigation
            explorer={explorer}
            navigationLabel={navigationLabel}
            root={root}
            rootSelected={!location.parentId}
            onRootPress={onRootPress}
            onSelectionChange={onSelectionChange}
          />
        )}
      <ExplorerBody
        explorer={explorer}
        items={readyItems}
        locale={selectedLocale}
      />
    </ExplorerModalContent>
  )
}

interface ExplorerPickerNavigationProps {
  explorer: DashboardExplorer
  navigationLabel: string
  onRootPress: () => void
  onSelectionChange: (keys: Selection) => void
  root: ReturnType<typeof rootAtoms>
  rootSelected: boolean
}

function ExplorerPickerNavigation({
  explorer,
  navigationLabel,
  onRootPress,
  onSelectionChange,
  root,
  rootSelected
}: ExplorerPickerNavigationProps) {
  const locale = useAtomValue(explorer.selectedLocale)
  const tree = explorerTree(root, explorer, locale)
  useAtomValue(explorerTreeReady(tree))
  return (
    <ExplorerModalNavigation>
      <SidebarTreeExplorer
        ariaLabel={navigationLabel}
        root={root}
        rootSelected={rootSelected}
        selectedLocale={explorer.selectedLocale}
        tree={tree}
        onRootPress={onRootPress}
        onSelectionChange={onSelectionChange}
      />
    </ExplorerModalNavigation>
  )
}
