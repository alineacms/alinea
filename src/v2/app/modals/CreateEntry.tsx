import {Button} from '@alinea/components'
import {Sheet, SheetContent, SheetDialog, SheetFooter} from '../ui/Sheet.js'

export function CreateEntry() {
  return (
    <Sheet>
      <SheetDialog>
        <SheetContent>title / path</SheetContent>
        <SheetFooter>
          <Button>Create entry</Button>
        </SheetFooter>
      </SheetDialog>
    </Sheet>
  )
}
