import {useAtomValue, useSetAtom} from 'jotai'
import {startTransition} from 'react'
import type {Key, Selection} from 'react-aria-components'
import type {DashboardExplorer, ExplorerOptions} from '../store.js'
import {ExplorerBody} from './Explorer.js'
import {ExplorerModalContent, ExplorerModalNavigation} from './ExplorerModal.js'
import {SidebarTreeExplorer} from './SidebarTree.js'

export interface ExplorerPickerContentProps {
  explorer: DashboardExplorer
  navigationLabel: string
  options: ExplorerOptions
}

export function ExplorerPickerContent({
  explorer,
  navigationLabel,
  options
}: ExplorerPickerContentProps) {
  const workspace = useAtomValue(explorer.workspace)
  const root = useAtomValue(explorer.root)
  const location = useAtomValue(explorer.location)
  const setLocation = useSetAtom(explorer.location)
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
        <ExplorerModalNavigation>
          <SidebarTreeExplorer
            ariaLabel={navigationLabel}
            root={root}
            rootSelected={!location.parentId}
            selectedKeys={selectedKeys}
            selectedLocale={explorer.selectedLocale}
            workspace={workspace}
            onRootPress={onRootPress}
            onSelectionChange={onSelectionChange}
          />
        </ExplorerModalNavigation>
      )}
      <ExplorerBody explorer={explorer} />
    </ExplorerModalContent>
  )
}
