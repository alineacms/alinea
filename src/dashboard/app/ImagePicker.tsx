// oxlint-disable jsx_a11y/no-autofocus
import {Button} from '#/components.js'
import {Workspace} from '#/core/Workspace.js'
import {useAtomValue, useSetAtom} from 'jotai'
import {startTransition, useState, type ReactNode} from 'react'
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

export interface ImagePickerOptions extends ExplorerOptions {
  label?: ReactNode
}

export function ImagePicker(options: ImagePickerOptions) {
  return (
    <DashboardModal size="explorer">
      <ExplorerModal options={options} />
    </DashboardModal>
  )
}

interface ExplorerModalProps {
  options: ImagePickerOptions
}

function ExplorerModal({options}: ExplorerModalProps) {
  const modal = useDashboardModal()
  const dashboard = useDashboard()
  const workspace = useAtomValue(dashboard.selectedWorkspace)
  const selectedRoot = useAtomValue(dashboard.selectedRoot)
  const config = useAtomValue(dashboard.config)
  const mediaRoot =
    workspace && config
      ? Workspace.defaultMediaRoot(config.workspaces[workspace])
      : selectedRoot
  const [explorer] = useState(() =>
    dashboard.explore(
      {workspace, root: mediaRoot},
      {...options, searchDepth: 'all'}
    )
  )
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems =
    selection === 'all' ? 0 : selection.size

  function onSubmit() {
    startTransition(() => {
      onConfirm()
      modal.close()
    })
  }

  return (
    <DashboardModalDialog
      aria-label={String(options.label ?? 'Pick media')}
      variant="explorer"
    >
      <DashboardModalExplorer>
        <ExplorerHeader
          controls={<DashboardModalCloseButton />}
          explorer={explorer}
        />
        <ExplorerBody explorer={explorer} />
        <RailHeader className={dashboardModalStyles.DashboardModalExplorer.footer()}>
          <span
            className={dashboardModalStyles.DashboardModalExplorer.selection()}
          >
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
