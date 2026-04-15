import {createId} from '#/core/Id.js'
import {type PickerProps, pickerWithView} from '#/core/Picker.js'
import {Reference} from '#/core/Reference.js'
import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {Modal} from '#/dashboard/view/Modal.js'
import {check} from '#/field/check.js'
import {text} from '#/field/text.js'
import {Button, HStack, Stack} from '#/ui.js'
import {type FormEvent, useMemo} from 'react'
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
      ? {
          url: preSelected[UrlReference.url],
          title: preSelected[UrlReference.title],
          blank: preSelected[UrlReference.target] === '_blank'
        }
      : undefined
  })
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    e.stopPropagation()
    const data = form.data()
    const reference: UrlReference = {
      [Reference.id]: preSelected?._id ?? createId(),
      [Reference.type]: 'url',
      [UrlReference.url]: data.url,
      [UrlReference.title]: data.title || '',
      [UrlReference.target]: data.blank ? '_blank' : '_self'
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
