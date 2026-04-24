import {suite} from '@alinea/suite'
import '#/dashboard/dom.js'
import {Button, DialogTrigger} from '#/components.js'
import {cleanup, fireEvent, render} from '@testing-library/react'
import {act} from 'react'
import {ExternalLinkPicker, type ExternalLinkValue} from './ExternalLinkPicker.js'

const test = suite(import.meta, {
  afterEach() {
    cleanup()
  }
})

interface ExampleProps {
  initialValue?: ExternalLinkValue
  onConfirm?: (value: ExternalLinkValue) => void
}

function Example({initialValue, onConfirm = () => {}}: ExampleProps) {
  return (
    <DialogTrigger defaultOpen>
      <Button>Edit link</Button>
      <ExternalLinkPicker
        initialValue={initialValue}
        selectionMode="single"
        submitLabel="Save link"
        onConfirm={onConfirm}
      />
    </DialogTrigger>
  )
}

test('prefills external link values when editing', () => {
  const view = render(
    <Example
      initialValue={{
        url: 'https://alineacms.com/docs',
        title: 'Alinea documentation',
        target: '_blank'
      }}
    />
  )

  const url = view.getByRole('textbox', {name: /URL/}) as HTMLInputElement
  const title = view.getByRole('textbox', {
    name: /Description/
  }) as HTMLInputElement
  const target = view.getByRole('checkbox', {
    name: 'Open link in new tab'
  }) as HTMLInputElement

  test.is(url.value, 'https://alineacms.com/docs')
  test.is(title.value, 'Alinea documentation')
  test.is(target.checked, true)
})

test('submits external link values through the modal form', async () => {
  let confirmed: ExternalLinkValue | undefined
  const view = render(
    <Example
      initialValue={{
        url: 'https://alineacms.com/docs',
        title: 'Alinea documentation',
        target: '_blank'
      }}
      onConfirm={value => {
        confirmed = value
      }}
    />
  )
  const url = view.getByRole('textbox', {name: /URL/})
  const form = url.closest('form')

  test.ok(Boolean(form))

  await act(async () => {
    fireEvent.submit(form!)
    await Promise.resolve()
  })

  test.equal(confirmed, {
    url: 'https://alineacms.com/docs',
    title: 'Alinea documentation',
    target: '_blank'
  })
})
