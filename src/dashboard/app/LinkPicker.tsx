import {Button} from '#/components.js'
import {useAtomValue, useSetAtom} from 'jotai'
import {startTransition, useState} from 'react'
import {ExplorerOptions, useDashboard} from '../store.js'
import {ExplorerBody, ExplorerHeader} from './Explorer.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  DashboardModalExplorer,
  DashboardModalExplorerActions,
  DashboardModalExplorerFooter,
  DashboardModalExplorerSelection,
  useDashboardModal
} from './ui/DashboardModal.js'

export function LinkPicker(options: ExplorerOptions) {
  return (
    <DashboardModal size="explorer">
      <ExplorerModal options={options} />
    </DashboardModal>
  )
}

interface ExplorerModalProps {
  options: ExplorerOptions
}

function ExplorerModal({options}: ExplorerModalProps) {
  const modal = useDashboardModal()
  const dashboard = useDashboard()
  const workspace = useAtomValue(dashboard.selectedWorkspace)
  const root = useAtomValue(dashboard.selectedRoot)
  const [explorer] = useState(() =>
    dashboard.explore(options.location ?? {workspace, root}, {
      ...options,
      searchDepth: 'all'
    })
  )
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size
  const onSubmit = () => {
    startTransition(() => {
      onConfirm()
      modal.close()
    })
  }
  return (
    <DashboardModalDialog aria-label="Pick a link" variant="explorer">
      <DashboardModalExplorer>
        <ExplorerHeader
          controls={<DashboardModalCloseButton />}
          explorer={explorer}
        />
        <ExplorerBody explorer={explorer} />
        <DashboardModalExplorerFooter>
          <DashboardModalExplorerSelection>
            {selectedItems} {selectedItems === 1 ? 'item' : 'items'} selected
          </DashboardModalExplorerSelection>
          <DashboardModalExplorerActions>
            <Button onPress={modal.close}>Cancel</Button>
            <Button intent="primary" onPress={onSubmit}>
              Select
            </Button>
          </DashboardModalExplorerActions>
        </DashboardModalExplorerFooter>
      </DashboardModalExplorer>
    </DashboardModalDialog>
  )
}
