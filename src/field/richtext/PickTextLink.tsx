import {Button, DialogTrigger, TextField} from '#/components.js'
import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import type {Graph} from '#/core/Graph.js'
import {createId} from '#/core/Id.js'
import {imageExtensions} from '#/core/media/IsImage.js'
import {mediaAltText} from '#/core/media/MediaAltField.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {Reference} from '#/core/Reference.js'
import {type as createType, Type} from '#/core/Type.js'
import type {EntryReference} from '#/picker/entry/EntryReference.js'
import {NodeEditor} from '#/dashboard/app/EntryFields.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {configAtom, graphAtom} from '#/dashboard/atoms/core.js'
import {useDashboardContext} from '#/dashboard/hooks.js'
import {ImagePicker} from '#/dashboard/app/ImagePicker.js'
import {mediaLiveUrl} from '#/dashboard/app/editor/MediaImageSource.js'
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
import {link as createLink, type LinkRow} from '#/field/link.js'
import type {LinkField} from '#/field/link/LinkField.js'
import styler from '@alinea/styler'
import {useAtomValue, type WritableAtom} from 'jotai'
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type SetStateAction
} from 'react'
import css from './PickTextLink.module.css'

export interface PickerValue {
  link?: Reference
  alt?: string
  description?: string
  src?: string
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

export interface PickRichTextImageFunc {
  (options: Partial<PickerOptions>): Promise<PickerValue | undefined>
}

const styles = styler(css)

type TextLinkValueAtom = WritableAtom<
  LinkRow | null,
  [SetStateAction<LinkRow | null>],
  void
>

interface PendingTextLinkPicker {
  kind: 'image' | 'link'
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
  kind: 'image' | 'link'
  options: Partial<PickerOptions>
  pickImage: PickRichTextImageFunc
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
      setPending({kind: 'link', options, resolve})
    })
  }, [])
  const pickImage = useCallback<PickRichTextImageFunc>(options => {
    return new Promise(resolve => {
      setPending({kind: 'image', options, resolve})
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
    kind: pending?.kind ?? 'link',
    options: pending?.options ?? {},
    pickImage,
    pickLink,
    cancel,
    confirm
  }
}

export function PickTextLink({picker}: PickTextLinkProps) {
  if (!picker.isOpen) return null
  if (picker.kind === 'image') return <PickRichTextImage picker={picker} />
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

function PickRichTextImage({picker}: PickTextLinkProps) {
  const config = useAtomValue(configAtom)
  const graph = useAtomValue(graphAtom)
  const locale = useDashboardContext().page.locale ?? undefined
  const confirming = useRef(false)
  const initialEntry = imageReferenceEntryId(picker.options.link)
  const initialSelection = initialEntry ? [initialEntry] : []

  function onConfirm(selection: Array<string>) {
    const [entryId] = selection
    if (!entryId) {
      picker.confirm({link: undefined})
      return
    }
    confirming.current = true
    void resolveRichTextImage(
      config,
      graph,
      entryId,
      picker.options.link,
      locale
    ).then(picker.confirm, error => {
      console.error(error)
      picker.cancel()
    })
  }

  return (
    <DialogTrigger
      isOpen
      onOpenChange={isOpen => {
        if (!isOpen && !confirming.current) picker.cancel()
      }}
    >
      <Button style={{display: 'none'}}>Pick image</Button>
      <ImagePicker
        condition={richTextImageCondition}
        initialSelection={initialSelection}
        label="Pick image"
        selectionBehavior="replace"
        selectionMode="single"
        onConfirm={onConfirm}
      />
    </DialogTrigger>
  )
}

async function resolveRichTextImage(
  config: Config,
  graph: Graph,
  entryId: string,
  existing: Reference | undefined,
  locale: string | undefined
): Promise<PickerValue> {
  const image = await graph.first({
    id: entryId,
    status: 'preferDraft',
    select: {
      workspace: Entry.workspace,
      location: MediaFile.location,
      alt: MediaFile.alt
    }
  })
  if (!image) throw new Error(`Image entry not found: ${entryId}`)
  const link: EntryReference = {
    [Reference.id]: existing?._id ?? createId(),
    [Reference.type]: 'image',
    _entry: entryId
  }
  return {
    alt: mediaAltText(image.alt, locale),
    link,
    src: mediaLiveUrl(config, image.workspace, image.location)
  }
}

const richTextImageCondition = {
  _type: 'MediaFile',
  extension: {
    in: [
      ...imageExtensions,
      ...imageExtensions.map(extension => extension.toUpperCase())
    ]
  }
}

function imageReferenceEntryId(reference: Reference | undefined) {
  if (!reference || reference._type !== 'image' || !('_entry' in reference))
    return
  return typeof reference._entry === 'string' ? reference._entry : undefined
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
