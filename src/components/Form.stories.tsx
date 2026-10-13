import {useState} from 'react'
import {Button} from './Button.js'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './Dialog.js'
import {Form} from './Form.js'
import {Select, SelectItem} from './Select.js'
import {TextField} from './TextField.js'

async function save(data: FormData) {
  await new Promise(resolve => setTimeout(resolve, 200))
  if (data.get('path') === '/about') return {path: 'This path is taken'}
  return undefined
}

/** Errors come from native constraints and from what onSubmit returns */
export function Example() {
  const [saved, setSaved] = useState<string>()
  return (
    <Form
      style={{display: 'grid', gap: 16, maxWidth: 360}}
      onSubmit={async data => {
        const errors = await save(data)
        if (!errors) setSaved(String(data.get('path')))
        return errors
      }}
    >
      <TextField label="Title" name="title" required />
      <TextField label="Path" name="path" defaultValue="/about" />
      <Select label="Type" name="type" defaultValue="page">
        <SelectItem value="page">Page</SelectItem>
        <SelectItem value="post">Blog post</SelectItem>
      </Select>
      <Button type="submit" color="primary">
        Save
      </Button>
      {saved && <p data-testid="saved">Saved {saved}</p>}
    </Form>
  )
}

/** The dialog closes once onSubmit resolves without errors */
export function InDialog() {
  return (
    <Dialog>
      <DialogTrigger>Rename page</DialogTrigger>
      <DialogContent onSubmit={save}>
        <DialogHeader>
          <DialogTitle>Rename page</DialogTitle>
        </DialogHeader>
        <TextField label="Path" name="path" defaultValue="/about" autoFocus />
        <DialogFooter>
          <Button type="submit" color="primary">
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default {
  title: 'Pure components / Form'
}
