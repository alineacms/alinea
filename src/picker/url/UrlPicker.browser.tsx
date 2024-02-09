import {createId} from 'alinea/core/Id'
import {PickerProps, pickerWithView} from 'alinea/core/Picker'
import {type} from 'alinea/core/Type'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {Modal} from 'alinea/dashboard/view/Modal'
import {check} from 'alinea/field/check'
import {text} from 'alinea/field/text'
import {Button, HStack, Stack} from 'alinea/ui'
import {FormEvent, useMemo} from 'react'
import {UrlReference, urlPicker as createUrlPicker} from './UrlPicker.js'
import {UrlPickerRow} from './UrlPickerRow.js'

export * from './UrlPicker.js'

export const urlPicker = pickerWithView(createUrlPicker, {
  view: UrlPickerModal,
  viewRow: UrlPickerRow
})

export function UrlPickerForm({
  selection,
  options,
  onConfirm,
  onCancel
}: PickerProps) {
  const preSelected = selection?.[0] as UrlReference | undefined
  const linkForm = useMemo(
    () =>
      type('Link', {
        fields: {
          url: text('Url', {
            required: true,
            help: 'Url of the link'
          }),
          title: text('Description', {
            help: 'Text to display inside the link element'
          }),
          blank: check('Target', {
            description: 'Open link in new tab',
            initialValue: true
          })
        }
      }),
    []
  )
  const form = useForm(linkForm, {
    initialValue: preSelected
      ? {...preSelected, blank: preSelected.target === '_blank'}
      : undefined
  })
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    e.stopPropagation()
    const data = form.data()
    const reference: UrlReference = {
      id: preSelected?.id ?? createId(),
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
      <InputForm border={false} form={form} />
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
