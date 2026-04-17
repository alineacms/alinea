import {Button, Modal} from '@alinea/components'
import {Workspace} from 'alinea/core/Workspace'
import {useAtomValue, useSetAtom} from 'jotai'
import {startTransition, useState} from 'react'
import {ExplorerOptions, useDashboard} from '../store'
import {Explorer} from './Explorer'
import {SheetContent, SheetDialog, SheetFooter, useSheet} from './ui/Sheet'

export function ImagePicker(options: ExplorerOptions) {
  return (
    <Modal isDismissable>
      <ExplorerSheet options={options} />
    </Modal>
  )
}

interface ExplorerSheetProps {
  options: ExplorerOptions
}

function ExplorerSheet({options}: ExplorerSheetProps) {
  const sheet = useSheet()
  const dashboard = useDashboard()
  const workspace = useAtomValue(dashboard.selectedWorkspace)
  const selectedRoot = useAtomValue(dashboard.selectedRoot)
  const config = useAtomValue(dashboard.config)
  const mediaRoot =
    workspace && config
      ? Workspace.defaultMediaRoot(config.workspaces[workspace])
      : selectedRoot
  const [explorer] = useState(() =>
    dashboard.explore({workspace, root: mediaRoot}, options)
  )
  const onConfirm = useSetAtom(explorer.onConfirm)
  const onSubmit = () => {
    startTransition(() => {
      onConfirm()
      sheet.close()
    })
  }
  return (
    <SheetDialog label="Pick a link">
      <SheetContent>
        <Explorer explorer={explorer} />
      </SheetContent>
      <SheetFooter>
        <Button intent="secondary" onPress={sheet.close}>
          Cancel
        </Button>
        <Button onPress={onSubmit}>Pick</Button>
      </SheetFooter>
    </SheetDialog>
  )
}
