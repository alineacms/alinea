import {cleanup, fireEvent, render, screen, waitFor} from '#test/react.js'
import {afterAll, afterEach, beforeAll, expect, test} from 'bun:test'
import {FormData as DomFormData} from 'happy-dom'
import {Button} from './Button.js'
import {DateField} from './DateField.js'
import {Dialog, DialogContent, DialogTitle} from './Dialog.js'
import {Form} from './Form.js'
import {TextField} from './TextField.js'
import {TimeField} from './TimeField.js'

afterEach(cleanup)

// The test DOM keeps the runtime's FormData, which cannot read its forms
const NativeFormData = globalThis.FormData
beforeAll(() => {
  globalThis.FormData = DomFormData as unknown as typeof FormData
})
afterAll(() => {
  globalThis.FormData = NativeFormData
})

function submit() {
  fireEvent.submit(document.querySelector('form')!)
}

test('Form shows validationErrors on fields by name', () => {
  render(
    <Form validationErrors={{title: 'Title is taken'}}>
      <TextField label="Title" name="title" />
      <TextField label="Path" name="path" />
    </Form>
  )
  expect(screen.getByText('Title is taken')).toBeTruthy()
  const [title, path] = screen.getAllByRole('textbox')
  expect(title.getAttribute('aria-invalid')).toBe('true')
  expect(path.getAttribute('aria-invalid')).toBeNull()
  fireEvent.change(title, {target: {value: 'About'}})
  expect(screen.queryByText('Title is taken')).toBeNull()
})

test('Form passes its data to onSubmit and shows the errors it returns', async () => {
  const submitted: Array<FormData> = []
  render(
    <Form
      onSubmit={data => {
        submitted.push(data)
        return {title: 'Title is required'}
      }}
    >
      <TextField label="Title" name="title" defaultValue="About" />
    </Form>
  )
  submit()
  await waitFor(() =>
    expect(screen.getByText('Title is required')).toBeTruthy()
  )
  expect(submitted[0].get('title')).toBe('About')
})

test('date and time fields submit native values', async () => {
  let data: FormData | undefined
  render(
    <Form onSubmit={next => void (data = next)}>
      <DateField label="Date" name="date" defaultValue="2026-09-23" />
      <TimeField label="Time" name="time" defaultValue="14:30" />
      <TimeField
        label="Precise"
        name="precise"
        granularity="second"
        defaultValue="14:30:15"
      />
      <TimeField label="Empty" name="empty" />
    </Form>
  )
  submit()
  await waitFor(() => expect(data).toBeTruthy())
  expect(data!.get('date')).toBe('2026-09-23')
  expect(data!.getAll('time')).toEqual(['14:30'])
  expect(data!.get('precise')).toBe('14:30:15')
  expect(data!.get('empty')).toBe('')
})

test('a field error takes precedence over validationErrors', () => {
  render(
    <Form validationErrors={{title: 'From the server'}}>
      <TextField label="Title" name="title" error="Too short" />
    </Form>
  )
  expect(screen.getByText('Too short')).toBeTruthy()
  expect(screen.queryByText('From the server')).toBeNull()
})

interface RenameDialogProps {
  onSubmit: (data: FormData) => {title: string} | undefined
  onOpenChange?: (open: boolean) => void
}

function RenameDialog({onSubmit, onOpenChange}: RenameDialogProps) {
  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent onSubmit={onSubmit}>
        <DialogTitle>Rename page</DialogTitle>
        <TextField label="Title" name="title" defaultValue="About" />
        <Button type="submit">Save</Button>
      </DialogContent>
    </Dialog>
  )
}

test('DialogContent with onSubmit closes once it succeeds', async () => {
  const titles: Array<unknown> = []
  const changes: Array<boolean> = []
  render(
    <RenameDialog
      onSubmit={data => {
        titles.push(data.get('title'))
        return undefined
      }}
      onOpenChange={open => changes.push(open)}
    />
  )
  submit()
  await waitFor(() => expect(changes).toEqual([false]))
  expect(titles).toEqual(['About'])
})

test('DialogContent with onSubmit stays open on errors', async () => {
  const changes: Array<boolean> = []
  render(
    <RenameDialog
      onSubmit={() => ({title: 'Title is taken'})}
      onOpenChange={open => changes.push(open)}
    />
  )
  submit()
  await waitFor(() => expect(screen.getByText('Title is taken')).toBeTruthy())
  expect(changes).toEqual([])
})
