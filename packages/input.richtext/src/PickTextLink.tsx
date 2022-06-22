import {type, TypeConfig} from '@alinea/core'
import {useForm} from '@alinea/editor/hook/UseForm'
import {check} from '@alinea/input.check'
import {link} from '@alinea/input.link'
import {text} from '@alinea/input.text'
import {Button, fromModule, HStack, Stack} from '@alinea/ui'
import {useTrigger} from '@alinea/ui/hook/UseTrigger'
import {Modal} from '@alinea/ui/Modal'
import {FormEvent} from 'react'
import css from './PickLink.module.scss'

const styles = fromModule(css)

const linkForm = type('Link', {
  link: link('Link', {
    type: ['entry', 'external']
  }),
  description: text('Description', {
    help: 'Text to display inside the link element'
  }),
  title: text('Title', {help: 'Extra information that describes the link'}),
  blank: check('Target', {
    label: 'Open link in new tab'
  })
})

export type PickerValue = typeof linkForm extends TypeConfig<infer K, any>
  ? K
  : never

export function usePickTextLink() {
  const trigger = useTrigger<PickerValue, Partial<PickerValue>>()
  return {
    options: trigger.options,
    open: trigger.isActive,
    onClose: trigger.reject,
    resolve: trigger.resolve,
    pickLink: trigger.request
  }
}

export type PickTextLinkState = ReturnType<typeof usePickTextLink>
export type PickTextLinkFunc = PickTextLinkState['pickLink']
export type PickTextLinkProps = {picker: PickTextLinkState}

export function PickTextLink({picker}: PickTextLinkProps) {
  const {open, onClose, resolve, options} = picker
  const [Form, formData] = useForm(
    {
      type: linkForm,
      initialValue: options
    },
    [options]
  )
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    return resolve(formData())
  }
  return (
    <Modal open={open} onClose={onClose} className={styles.root()}>
      <form onSubmit={handleSubmit}>
        <Form />
        <HStack>
          <Stack.Right>
            <Button>Confirm</Button>
          </Stack.Right>
        </HStack>
      </form>
    </Modal>
  )
}
