import {Button} from '#/components.js'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense, useState} from 'react'
import {createExplorerAtoms, type ExplorerOptions} from '../atoms/explorer.js'
import {
  selectedRootAtom,
  selectedWorkspaceAtom
} from '../atoms/routing/index.js'
import {ExplorerHeader} from './Explorer.js'
import {
  ExplorerModal,
  ExplorerModalActions,
  ExplorerModalFooter,
  ExplorerModalSelection,
  ExplorerModalSuspense
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
      <Suspense
        fallback={
          <DashboardModalDialog
            aria-label="Pick a link"
            variant="explorer"
            isLoading
          />
        }
      >
        <LinkPickerModalContent options={options} />
      </Suspense>
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
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size
  const onSubmit = () => {
    onConfirm()
    modal.close()
  }
  return (
    <DashboardModalDialog aria-label="Pick a link" variant="explorer">
      <ExplorerModalSuspense>
        <ExplorerModal>
          <ExplorerHeader
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
          />
          <ExplorerPickerContent
            explorer={explorer}
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
      </ExplorerModalSuspense>
    </DashboardModalDialog>
  )
}
