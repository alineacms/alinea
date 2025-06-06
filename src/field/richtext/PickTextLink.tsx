import styler from '@alinea/styler'
import {Reference} from 'alinea/core/Reference'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {track} from 'alinea/core/Tracker'
import {type} from 'alinea/core/Type'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {Modal} from 'alinea/dashboard/view/Modal'
import {check} from 'alinea/field/check'
import {link as createLink} from 'alinea/field/link'
import {text} from 'alinea/field/text'
import type {EntryReference} from 'alinea/picker/entry/EntryReference'
import {Button, HStack, Stack, VStack} from 'alinea/ui'
import {useTrigger} from 'alinea/ui/hook/UseTrigger'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {type FormEvent, useMemo} from 'react'
import css from './PickLink.module.scss'

const styles = styler(css)

function linkForm(options: PickerOptions) {
  const isExistingLink = Boolean(options.link)
  const fields = type('Pick link', {
    fields: {
      link: createLink('Link', {
        required: true,
        initialValue: options.link as EntryReference & ListRow
      }),
      description: text('Description', {
        help: 'Text to display inside the link element'
      }),
      title: text('Tooltip', {
        help: 'Extra information that describes the link, shown on hover'
      }),
      blank: check('Open link in new tab', {
        inline: true
      })
    }
  })
  track.options(fields.description, get => {
    const selected = get(fields.link)
    const isUrl = selected?.[Reference.type] === 'url'
    const descriptionRequired =
      options.requireDescription && !(isExistingLink || isUrl)
    return {hidden: !descriptionRequired}
  })
  track.options(fields.blank, get => {
    const selected = get(fields.link)
    const isUrl = selected?.[Reference.type] === 'url'
    return {hidden: isUrl}
  })
  return fields
}

export type PickerValue = {
  link?: Reference
  description?: string
  title?: string
  blank?: boolean
}

export type PickerOptions = PickerValue & {
  requireDescription?: boolean
  hasLink?: boolean
}

export function usePickTextLink() {
  const trigger = useTrigger<PickerValue, Partial<PickerOptions>>()
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

export function PickTextLinkForm({
  open,
  onClose,
  resolve,
  options = {}
}: PickTextLinkState) {
  const type = useMemo(() => linkForm(options), [options])
  const form = useForm(type, {
    initialValue: options as any
  })
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    e.stopPropagation()
    const result = form.data()
    return resolve(result)
  }
  return (
    <>
      {open && (
        <form onSubmit={handleSubmit}>
          <VStack gap={18}>
            <div>
              <InputForm form={form} border={false} />
            </div>
            <HStack>
              {options.hasLink && (
                <Button
                  icon={IcRoundClose}
                  outline
                  type="button"
                  onClick={() => resolve(undefined)}
                >
                  Remove link
                </Button>
              )}
              <Stack.Right>
                <HStack gap={16}>
                  <Button outline type="button" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button>Confirm</Button>
                </HStack>
              </Stack.Right>
            </HStack>
          </VStack>
        </form>
      )}
    </>
  )
}

export function PickTextLink({picker}: PickTextLinkProps) {
  if (!picker.open) return null
  return (
    <Modal open onClose={picker.onClose} className={styles.root()}>
      <PickTextLinkForm {...picker} />
    </Modal>
  )
}
