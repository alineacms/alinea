import {Button} from '#/components.js'
import {useAtomValue, useSetAtom} from 'jotai'
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
import {ExplorerPickerContent} from './ExplorerPickerContent.js'
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
  const [explorer] = useState(() =>
    createExplorerAtoms(location, {
      ...options,
      searchDepth: 'all'
    })
  )
  const snapshot = useAtomValue(explorer.snapshot)
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size
  const onSubmit = () => {
    onConfirm()
    modal.close()
  }
  if (!snapshot) return null
  return (
    <DashboardModalDialog aria-label="Pick a link" variant="explorer">
      <ExplorerModal>
        <ExplorerHeader
          controls={<DashboardModalCloseButton />}
          explorer={explorer}
          items={snapshot.items}
        />
        <ExplorerPickerContent
          explorer={explorer}
          items={snapshot.items}
          navigationLabel="Link folders"
          options={options}
        />
        <ExplorerModalFooter>
          <ExplorerModalSelection>
            {selectedItems} {selectedItems === 1 ? 'item' : 'items'} selected
          </ExplorerModalSelection>
          <ExplorerModalActions>
            <Button onPress={modal.close}>Cancel</Button>
            <Button intent="primary" onPress={onSubmit}>
              Select
            </Button>
          </ExplorerModalActions>
        </ExplorerModalFooter>
      </ExplorerModal>
    </DashboardModalDialog>
  )
}
