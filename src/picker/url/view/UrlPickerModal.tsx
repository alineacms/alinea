import {createId, type} from 'alinea/core'
import {InputForm} from 'alinea/editor'
import {useForm} from 'alinea/editor/hook/UseForm'
import {PickerProps} from 'alinea/editor/Picker'
import {check} from 'alinea/input/check'
import {text} from 'alinea/input/text'
import {Button, HStack, Stack} from 'alinea/ui'
import {Modal} from 'alinea/ui/Modal'
import {FormEvent} from 'react'
import {UrlReference} from '../UrlPicker'

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

export function UrlPickerForm({options, onConfirm, onCancel}: PickerProps) {
  const form = useForm(
    {
      type: linkForm,
      initialValue: options
    },
    [options]
  )
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    e.stopPropagation()
    const data = form()
    const reference: UrlReference = {
      id: createId(),
      type: 'url',
      url: data.url,
      description: data.description || '',
      target: data.blank ? '_blank' : '_self'
    }
    if (!data.url) return
    onConfirm([reference])
  }
  return (
    <form onSubmit={handleSubmit}>
      <InputForm {...form} />
      <HStack>
        <Stack.Right>
          <HStack gap={16}>
            <Button outline type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button>Confirm</Button>
          </HStack>
        </Stack.Right>
      </HStack>
    </form>
  )
}

export function UrlPickerModal(props: PickerProps) {
  return (
    <Modal open onClose={props.onCancel}>
      <UrlPickerForm {...props} />
    </Modal>
  )
}
