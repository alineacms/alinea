import {Picker, PickerProps, createId, type} from 'alinea/core'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {Modal} from 'alinea/dashboard/view/Modal'
import {check} from 'alinea/input/check'
import {text} from 'alinea/input/text'
import {Button, HStack, Stack} from 'alinea/ui'
import {FormEvent} from 'react'
import {UrlReference, urlPicker as createUrlPicker} from './UrlPicker.js'
import {UrlPickerRow} from './UrlPickerRow.js'

export * from './UrlPicker.js'

export const urlPicker = Picker.withView(createUrlPicker, {
  view: UrlPickerModal,
  viewRow: UrlPickerRow
})

const linkForm = type('Link', {
  url: text('Url', {
    help: 'Url of the link'
  }),
  title: text('Description', {
    optional: true,
    help: 'Text to display inside the link element'
  }),
  blank: check('Open link in new tab', {
    description: 'Target',
    initialValue: true
  })
})

export function UrlPickerForm({options, onConfirm, onCancel}: PickerProps) {
  const form = useForm(linkForm, {initialValue: options})
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    e.stopPropagation()
    const data = form.data()
    const reference: UrlReference = {
      id: createId(),
      type: 'url',
      ref: 'url',
      url: data.url,
      title: data.title || '',
      target: data.blank ? '_blank' : '_self'
    }
    onConfirm([reference])
  }
  return (
    <form onSubmit={handleSubmit}>
      <InputForm border={false} form={form} type={linkForm} />
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
