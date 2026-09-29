'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from 'alinea/components'
import {IcRoundDelete} from 'alinea/dashboard/icons'

export function DialogAlertExample() {
  return (
    <Dialog>
      <DialogTrigger color="destructive" variant="outline" icon={IcRoundDelete}>
        Delete
      </DialogTrigger>
      <DialogContent
        role="alertdialog"
        dismissable={false}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Delete “Linen shirt”?</DialogTitle>
          <DialogDescription>
            The entry and its translations are removed. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose variant="ghost">Keep it</DialogClose>
          <DialogClose color="destructive">Delete entry</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
