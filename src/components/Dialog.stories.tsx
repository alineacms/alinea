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
  DialogTrigger,
  useDialog
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

function SaveButton() {
  const dialog = useDialog()
  return (
    <Button color="primary" onClick={dialog.close}>
      Save {dialog.open ? '(open)' : ''}
    </Button>
  )
}

export function Sizes() {
  return (
    <div style={{display: 'flex', gap: 8}}>
      {(['default', 'lg', 'full'] as const).map(size => (
        <Dialog key={size}>
          <DialogTrigger>{`Open ${size}`}</DialogTrigger>
          <DialogContent size={size} showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>{`Size ${size}`}</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <SaveButton />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  )
}

export default {
  title: 'Pure components / Dialog'
}
