'use client'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  TextField
} from 'alinea/components'
import {useState} from 'react'

export function DialogFormExample() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('Oak & Loom')
  const [draft, setDraft] = useState(name)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Site name: {name}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Site settings</DialogTitle>
          </DialogHeader>
          <TextField label="Site name" value={draft} onValueChange={setDraft} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              onClick={() => {
                setName(draft)
                setOpen(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
