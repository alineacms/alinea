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
  dashboardModalStyles,
  useDashboardModal
} from './ui/DashboardModal.js'
import {RailHeader} from './ui/Rail.js'

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
    dashboard.explore({workspace, root}, options)
  )
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems =
    selection === 'all' ? 0 : selection.size
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
        <RailHeader className={dashboardModalStyles.DashboardModalExplorer.footer()}>
          <span>
            {selectedItems} {selectedItems === 1 ? 'item' : 'items'} selected
          </span>
          <div
            className={dashboardModalStyles.DashboardModalExplorer.actions()}
          >
            <Button intent="secondary" onPress={modal.close}>
              Cancel
            </Button>
            <Button onPress={onSubmit}>Pick</Button>
          </div>
        </RailHeader>
      </DashboardModalExplorer>
    </DashboardModalDialog>
  )
}
