import {useAtomValue} from '../AtomHooks.js'
import {AtomSnapshot} from '../AtomSnapshot.js'
import {Button} from '#/components.js'
import {useSetAtom} from 'jotai'
import {useState} from 'react'
import {createExplorerAtoms, type ExplorerOptions} from '../atoms/explorer.js'
import {selectedRootAtom, selectedWorkspaceAtom} from '../atoms/routing.js'
import {ExplorerHeader} from './Explorer.js'
import {
  ExplorerModal,
  ExplorerModalActions,
  ExplorerModalFooter,
  ExplorerModalSelection
} from './ExplorerModal.js'
import {
  createExplorerPickerSnapshot,
  ExplorerPickerContent
} from './ExplorerPickerContent.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  useDashboardModal
} from './ui/DashboardModal.js'

export function LinkPicker(options: ExplorerOptions) {
  return (
    <DashboardModal size="explorer">
      <LinkPickerModalContent options={options} />
    </DashboardModal>
  )
}

interface ExplorerModalProps {
  options: ExplorerOptions
}

function LinkPickerModalContent({options}: ExplorerModalProps) {
  const modal = useDashboardModal()
  const workspace = useAtomValue(selectedWorkspaceAtom)
  const root = useAtomValue(selectedRootAtom)
  const location = options.location ?? {
    workspace,
    root: root ?? undefined
  }
  const [{explorer, snapshot, tree}] = useState(() => {
    const explorer = createExplorerAtoms(location, {
      ...options,
      searchDepth: 'all'
    })
    return {
      explorer,
      ...createExplorerPickerSnapshot(explorer, location.workspace)
    }
  })
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size
  const onSubmit = () => {
    onConfirm()
    modal.close()
  }
  return (
    <DashboardModalDialog aria-label="Pick a link" variant="explorer">
      <AtomSnapshot atom={snapshot}>
        {prepared => (
          <ExplorerModal>
            <ExplorerHeader
              controls={<DashboardModalCloseButton />}
              explorer={explorer}
              items={prepared.items}
              navigate={true}
            />
            <ExplorerPickerContent
              explorer={explorer}
              items={prepared.items}
              navigationLabel="Link folders"
              options={options}
              preparedTree={prepared.preparedTree}
              tree={tree}
            />
            <ExplorerModalFooter>
              <ExplorerModalSelection>
                {selectedItems} {selectedItems === 1 ? 'item' : 'items'}{' '}
                selected
              </ExplorerModalSelection>
              <ExplorerModalActions>
                <Button onPress={modal.close}>Cancel</Button>
                <Button intent="primary" onPress={onSubmit}>
                  Select
                </Button>
              </ExplorerModalActions>
            </ExplorerModalFooter>
          </ExplorerModal>
        )}
      </AtomSnapshot>
    </DashboardModalDialog>
  )
}
