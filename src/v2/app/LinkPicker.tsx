import {Button} from '@alinea/components'
import {useAtomValue} from 'jotai'
import {useState} from 'react'
import {useDashboard} from '../store.js'
import {Explorer} from './Explorer.js'
import {
  Sheet,
  SheetContent,
  SheetDialog,
  SheetFooter,
  useSheet
} from './ui/Sheet.js'

export function LinkPicker() {
  return (
    <Sheet>
      <ExplorerSheet />
    </Sheet>
  )
}

function ExplorerSheet() {
  const sheet = useSheet()
  const dashboard = useDashboard()
  const workspace = useAtomValue(dashboard.selectedWorkspace)
  const root = useAtomValue(dashboard.selectedRoot)
  const [explorer] = useState(() => dashboard.explore({workspace, root}))
  return (
    <SheetDialog label="Pick a link">
      <SheetContent>
        <Explorer explorer={explorer} />
      </SheetContent>
      <SheetFooter>
        <Button intent="secondary" onPress={sheet.close}>
          Cancel
        </Button>
        <Button type="submit">Pick</Button>
      </SheetFooter>
    </SheetDialog>
  )
}
