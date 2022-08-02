import {createId, type} from '@alinea/core'
import {Reference} from '@alinea/core/Reference'
import {useForm} from '@alinea/editor/hook/UseForm'
import {PickerProps} from '@alinea/editor/Picker'
import {check} from '@alinea/input.check'
import {text} from '@alinea/input.text'
import {Button, HStack, Stack} from '@alinea/ui'
import {Modal} from '@alinea/ui/Modal'
import {FormEvent} from 'react'

const linkForm = type('Link', {
  url: text('Url', {
    help: 'Url of the link'
  }),
  description: text('Description', {
    optional: true,
    help: 'Text to display inside the link element'
  }),
  blank: check('Target', {
    label: 'Open link in new tab',
    initialValue: true
  })
})

export function ExternalLinkPickerForm({options, onConfirm}: PickerProps) {
  const [Form, formData] = useForm(
    {
      type: linkForm,
      initialValue: options
    },
    [options]
  )
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = formData()
    onConfirm([
      {
        id: createId(),
        type: 'url',
        url: data.url,
        description: data.description,
        target: data.blank ? '_blank' : '_self'
      } as Reference.Url
    ])
  }
  return (
    <form onSubmit={handleSubmit}>
      <Form />
      <HStack>
        <Stack.Right>
          <Button>Confirm</Button>
        </Stack.Right>
      </HStack>
    </form>
  )
}

export function ExternalLinkPicker(props: PickerProps) {
  return (
    <Modal open onClose={props.onCancel}>
      <ExternalLinkPickerForm {...props} />
    </Modal>
  )
}
