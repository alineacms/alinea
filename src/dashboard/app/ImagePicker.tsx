// oxlint-disable jsx_a11y/no-autofocus
import {Button, Modal} from '#/components.js'
import {Workspace} from '#/core/Workspace.js'
import {useAtomValue, useSetAtom} from 'jotai'
import {startTransition, useState} from 'react'
import {ExplorerOptions, useDashboard} from '../store.js'
import {Explorer} from './Explorer.js'
import {SheetContent, SheetDialog, SheetFooter, useSheet} from './ui/Sheet.js'

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

  function onSubmit() {
    startTransition(() => {
      onConfirm()
      sheet.close()
    })
  }

  return (
    <SheetDialog label="Pick an image">
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
