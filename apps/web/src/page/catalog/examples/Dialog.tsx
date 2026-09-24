'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  TextField
} from 'alinea/components'

export function DialogExample() {
  return (
    <Dialog>
      <DialogTrigger variant="outline">Rename entry</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename entry</DialogTitle>
          <DialogDescription>
            The URL of the entry stays the same.
          </DialogDescription>
        </DialogHeader>
        <TextField label="Title" defaultValue="Summer collection" autoFocus />
        <DialogFooter>
          <DialogClose variant="ghost">Cancel</DialogClose>
          <DialogClose color="primary">Save</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
