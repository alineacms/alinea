import {useAtomValue, useSetAtom} from 'jotai'
import type {Key, Selection} from 'react-aria-components'
import type {ExplorerAtoms, ExplorerOptions} from '../atoms/ExplorerAtoms.js'
import {ExplorerBody} from './Explorer.js'
import {ExplorerModalContent, ExplorerModalNavigation} from './ExplorerModal.js'
import {SidebarTreeExplorer} from './SidebarTree.js'

export interface ExplorerPickerContentProps {
  explorer: ExplorerAtoms
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
  const navigate = useSetAtom(explorer.navigate)
  const enableNavigation = options.enableNavigation ?? true
  const selectedKeys = location.parentId
    ? new Set<Key>([location.parentId])
    : new Set<Key>()

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
