import {rootAtoms} from '#/dashboard/atoms/root.js'
import {useDashboardContext} from '#/dashboard/hooks.js'
import {useAtomValue, useSetAtom} from 'jotai'
import {startTransition} from 'react'
import type {Key, Selection} from 'react-aria-components'
import type {DashboardExplorer} from '../atoms/explorer.js'
import {ExplorerBody} from './Explorer.js'
import {ExplorerModalContent, ExplorerModalNavigation} from './ExplorerModal.js'
import {SidebarTreeExplorer} from './SidebarTree.js'

export interface ExplorerPickerContentProps {
  explorer: DashboardExplorer
  navigationLabel: string
  options: {enableNavigation?: boolean}
}

export function ExplorerPickerContent({
  explorer,
  navigationLabel,
  options
}: ExplorerPickerContentProps) {
  const location = useAtomValue(explorer.location)
  const {page} = useDashboardContext()
  const selectedLocale = useAtomValue(explorer.selectedLocale)
  const setLocation = useSetAtom(explorer.location)
  const root = location.root
    ? rootAtoms(page, location.workspace, location.root, selectedLocale)
    : undefined
  const enableNavigation = options.enableNavigation ?? true
  const selectedKeys = location.parentId
    ? new Set<Key>([location.parentId])
    : new Set<Key>()

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
      {enableNavigation && root && (
        <ExplorerPickerNavigation
          explorer={explorer}
          navigationLabel={navigationLabel}
          root={root}
          rootSelected={!location.parentId}
          selectedKeys={selectedKeys}
          onRootPress={onRootPress}
          onSelectionChange={onSelectionChange}
        />
      )}
      <ExplorerBody explorer={explorer} />
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
  selectedKeys: Set<Key>
}

function ExplorerPickerNavigation({
  explorer,
  navigationLabel,
  onRootPress,
  onSelectionChange,
  root,
  rootSelected,
  selectedKeys
}: ExplorerPickerNavigationProps) {
  useAtomValue(root.treeReady)
  return (
    <ExplorerModalNavigation>
      <SidebarTreeExplorer
        ariaLabel={navigationLabel}
        root={root}
        rootSelected={rootSelected}
        selectedKeys={selectedKeys}
        selectedLocale={explorer.selectedLocale}
        onRootPress={onRootPress}
        onSelectionChange={onSelectionChange}
      />
    </ExplorerModalNavigation>
  )
}
