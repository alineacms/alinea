import {useState} from 'react'
import {Button} from './Button.js'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './Dialog.js'
import {TextField} from './TextField.js'

export function Example() {
  return (
    <Dialog>
      <DialogTrigger color="primary">Edit profile</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here.
          </DialogDescription>
        </DialogHeader>
        <TextField label="Name" defaultValue="Ada Lovelace" autoFocus />
        <DialogFooter>
          <DialogClose variant="ghost">Cancel</DialogClose>
          <DialogClose color="primary">Save</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Controlled() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open from outside</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent role="alertdialog" dismissable={false}>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep editing
            </Button>
            <Button color="destructive" onClick={() => setOpen(false)}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default {
  title: 'Pure components / Dialog'
}
