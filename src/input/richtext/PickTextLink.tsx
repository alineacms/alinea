import {Reference, type} from 'alinea/core'
import {InputForm, useField} from 'alinea/editor'
import {useForm} from 'alinea/editor/hook/UseForm'
import {InputField} from 'alinea/editor/view/InputField'
import {check} from 'alinea/input/check'
import {link as createLink} from 'alinea/input/link'
import {text} from 'alinea/input/text'
import {
  Button,
  fromModule,
  HStack,
  Stack,
  useObservable,
  VStack
} from 'alinea/ui'
import {useTrigger} from 'alinea/ui/hook/UseTrigger'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {Modal} from 'alinea/ui/Modal'
import {FormEvent, useMemo} from 'react'
import css from './PickLink.module.scss'

const styles = fromModule(css)

function linkForm({showDescription = true, showBlank = true}) {
  return type('Link', {
    description: text('Description', {
      hidden: !showDescription,
      help: 'Text to display inside the link element'
    }),
    title: text('Tooltip', {
      optional: true,
      help: 'Extra information that describes the link'
    }),
    blank: check('Target', {
      hidden: !showBlank,
      label: 'Open link in new tab'
    })
  })
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
  const isExistingLink = Boolean(options.link)
  const link = useField(
    createLink('Link', {
      initialValue: options.link && [options.link]
    })
  )
  const [selected] = useObservable(link)
  const isUrl = selected?.type === 'url'
  const descriptionRequired =
    options.requireDescription && !(isExistingLink || isUrl)
  const formType = useMemo(
    () =>
      linkForm({
        showDescription: descriptionRequired,
        showBlank: !isUrl
      }),
    [descriptionRequired, isUrl]
  )
  const form = useForm(
    {
      type: formType,
      initialValue: options
    },
    [formType]
  )
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    e.stopPropagation()
    const result = {...form(), link: selected}
    if (descriptionRequired && !result.description) return
    return resolve(result)
  }
  return (
    <>
      {open && (
        <form onSubmit={handleSubmit}>
          <VStack gap={18}>
            <div>
              <InputField {...link} />
              {selected && <InputForm {...form} />}
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
