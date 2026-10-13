'use client'

import {
  Button,
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

// Stands in for a request to your own API, which returns errors by field name
async function movePage(data: FormData) {
  await new Promise(resolve => setTimeout(resolve, 300))
  if (data.get('path') === 'about') return {path: 'This path is taken'}
  return undefined
}

export function DialogSubmitExample() {
  return (
    <Dialog>
      <DialogTrigger variant="outline">Change path</DialogTrigger>
      <DialogContent onSubmit={movePage}>
        <DialogHeader>
          <DialogTitle>Change path</DialogTitle>
          <DialogDescription>Try “about” to see an error.</DialogDescription>
        </DialogHeader>
        <TextField label="Path" name="path" defaultValue="about" autoFocus />
        <DialogFooter>
          <DialogClose variant="ghost">Cancel</DialogClose>
          <Button type="submit" color="primary">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
