import {useState} from 'react'
import {IcRoundAdd} from '#/dashboard/icons.js'
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
      <DialogTrigger color="primary" icon={IcRoundAdd}>
        Create user
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            New users sign in with their email address.
          </DialogDescription>
        </DialogHeader>
        <TextField label="Email" type="email" required autoFocus />
        <TextField label="Name" />
        <DialogFooter>
          <DialogClose variant="outline" color="secondary">
            Cancel
          </DialogClose>
          <DialogClose color="primary">Create user</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Controlled() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Deactivate Ada Lovelace</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent role="alertdialog" dismissable={false}>
          <DialogHeader>
            <DialogTitle>Deactivate account</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate Ada Lovelace? This will remove
              the user account and role assignments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              color="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button color="destructive" onClick={() => setOpen(false)}>
              Deactivate account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function Notice() {
  return (
    <Dialog>
      <DialogTrigger>Save entry</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>URL already in use</DialogTitle>
          <DialogDescription>
            The URL /about is already defined on another entry. Change the entry
            path or remove this alias, then try again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose color="primary">OK</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
