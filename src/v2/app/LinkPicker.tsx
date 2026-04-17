import {Button} from '#/components.js'
import {useAtomValue, useSetAtom} from 'jotai'
import {startTransition, useState} from 'react'
import {ExplorerOptions, useDashboard} from '../store.js'
import {Explorer} from './Explorer.js'
import {
  Sheet,
  SheetContent,
  SheetDialog,
  SheetFooter,
  useSheet
} from './ui/Sheet.js'

export function LinkPicker(options: ExplorerOptions) {
  return (
    <Sheet>
      <ExplorerSheet options={options} />
    </Sheet>
  )
}

interface ExplorerSheetProps {
  options: ExplorerOptions
}

function ExplorerSheet({options}: ExplorerSheetProps) {
  const sheet = useSheet()
  const dashboard = useDashboard()
  const workspace = useAtomValue(dashboard.selectedWorkspace)
  const root = useAtomValue(dashboard.selectedRoot)
  const [explorer] = useState(() =>
    dashboard.explore({workspace, root}, options)
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
