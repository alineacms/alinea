import {Button, TextField} from '#/components.js'
import {Reference} from '#/core/Reference.js'
import {type as createType, Type} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  DashboardModalForm,
  DashboardModalFormBody,
  DashboardModalFormFooter,
  DashboardModalFormHeader,
  DashboardModalTitle,
  useDashboardModal
} from '#/dashboard/app/ui/DashboardModal.js'
import {ReactiveNode} from '#/dashboard/store.js'
import {link as createLink, type LinkRow} from '#/field/link.js'
import type {LinkField} from '#/field/link/LinkField.js'
import styler from '@alinea/styler'
import {useAtomValue, type WritableAtom} from 'jotai'
import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type SetStateAction
} from 'react'
import css from './PickTextLink.module.css'

export interface PickerValue {
  link?: Reference
  description?: string
  title?: string
  blank?: boolean
}

export interface PickerOptions extends PickerValue {
  requireDescription?: boolean
  hasLink?: boolean
}

export interface PickTextLinkFunc {
  (options: Partial<PickerOptions>): Promise<PickerValue | undefined>
}

const styles = styler(css)

type TextLinkValueAtom = WritableAtom<
  LinkRow | null,
  [SetStateAction<LinkRow | null>],
  void
>

interface PendingTextLinkPicker {
  options: Partial<PickerOptions>
  resolve: (value: PickerValue | undefined) => void
}

interface TextLinkEditor {
  node: ReactiveNode<object>
  type: Type
  value: TextLinkValueAtom
}

export interface PickTextLinkState {
  isOpen: boolean
  options: Partial<PickerOptions>
  pickLink: PickTextLinkFunc
  cancel: () => void
  confirm: (value: PickerValue | undefined) => void
}

export interface PickTextLinkProps {
  picker: PickTextLinkState
}

export function usePickTextLink(): PickTextLinkState {
  const [pending, setPending] = useState<PendingTextLinkPicker | undefined>()
  const pickLink = useCallback<PickTextLinkFunc>(options => {
    return new Promise(resolve => {
      setPending({options, resolve})
    })
  }, [])
  const cancel = useCallback(() => {
    setPending(current => {
      current?.resolve(undefined)
      return undefined
    })
  }, [])
  const confirm = useCallback((value: PickerValue | undefined) => {
    setPending(current => {
      current?.resolve(value)
      return undefined
    })
  }, [])
  return {
    isOpen: Boolean(pending),
    options: pending?.options ?? {},
    pickLink,
    cancel,
    confirm
  }
}

export function PickTextLink({picker}: PickTextLinkProps) {
  if (!picker.isOpen) return null
  return (
    <DashboardModal
      isOpen
      onOpenChange={isOpen => {
        if (!isOpen) picker.cancel()
      }}
    >
      <PickTextLinkForm picker={picker} />
    </DashboardModal>
  )
}

function PickTextLinkForm({picker}: PickTextLinkProps) {
  const modal = useDashboardModal()
  const options = picker.options
  const linkEditor = useMemo(
    () => createLinkEditor(referenceToLinkRow(options.link)),
    [options.link]
  )
  const link = useAtomValue(linkEditor.value)
  const [title, setTitle] = useState(options.title ?? '')

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    picker.confirm({
      link: link ?? undefined,
      title: title.trim()
    })
    modal.close()
  }

  return (
    <DashboardModalDialog aria-label="Pick text link">
      <DashboardModalForm onSubmit={onSubmit}>
        <DashboardModalFormHeader>
          <DashboardModalTitle>Pick text link</DashboardModalTitle>
          <DashboardModalCloseButton />
        </DashboardModalFormHeader>
        <DashboardModalFormBody>
          <div className={styles.PickTextLink()}>
            <NodeEditor node={linkEditor.node} type={linkEditor.type} />
            <TextField
              description="Extra information that describes the link, shown on hover"
              label="Tooltip"
              value={title}
              onChange={setTitle}
            />
          </div>
        </DashboardModalFormBody>
        <DashboardModalFormFooter>
          <Button
            appearance="outline"
            intent="secondary"
            type="button"
            onPress={modal.close}
          >
            Cancel
          </Button>
          <Button type="submit">Confirm</Button>
        </DashboardModalFormFooter>
      </DashboardModalForm>
    </DashboardModalDialog>
  )
}

function createLinkEditor(initialValue?: LinkRow | null): TextLinkEditor {
  const field = createLink('Link', {
    initialValue: initialValue ?? null!
  }) as LinkField<LinkRow, unknown>
  const formType = createType('Text link', {
    fields: {
      link: field
    }
  })
  const value = Type.initialValue(formType) as Record<string, unknown>
  if (initialValue !== undefined) value.link = initialValue
  const node = new ReactiveNode(value as object)
  return {
    node,
    type: formType,
    value: node.field('link') as TextLinkValueAtom
  }
}

function referenceToLinkRow(reference: PickerValue['link']): LinkRow | null {
  if (!reference) return null
  return {
    ...reference,
    [Reference.id]: reference[Reference.id]
  } as LinkRow
}
