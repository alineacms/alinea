import {Button, TextField} from '#/components.js'
import {createId} from '#/core/Id.js'
import {imageExtensions} from '#/core/media/IsImage.js'
import {Reference} from '#/core/Reference.js'
import {type as createType, Type} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {ExplorerHeader} from '#/dashboard/app/Explorer.js'
import {
  ExplorerModal,
  ExplorerModalActions,
  ExplorerModalFooter,
  ExplorerModalSelection,
  ExplorerModalSuspense
} from '#/dashboard/app/ExplorerModal.js'
import {ExplorerPickerContent} from '#/dashboard/app/ExplorerPickerContent.js'
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
import {useDashboard} from '#/dashboard/hooks.js'
import {
  type DashboardEntryState,
  type ExplorerOptions,
  ReactiveNode
} from '#/dashboard/store.js'
import {link as createLink, type LinkRow} from '#/field/link.js'
import type {LinkField} from '#/field/link/LinkField.js'
import styler from '@alinea/styler'
import {atom, useAtomValue, useSetAtom, type WritableAtom} from 'jotai'
import {
  startTransition,
  Suspense,
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
  height?: number
  src?: string
  title?: string
  width?: number
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

interface RichTextImageReference extends Reference {
  _type: 'image'
  _entry: string
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
  if (picker.kind === 'image')
    return <PickRichTextImageExplorer picker={picker} />
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
  return <PickRichTextLinkForm picker={picker} />
}

function PickRichTextLinkForm({picker}: PickTextLinkProps) {
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

function PickRichTextImageExplorer({picker}: PickTextLinkProps) {
  return (
    <DashboardModal
      isOpen
      size="explorer"
      onOpenChange={isOpen => {
        if (!isOpen) picker.cancel()
      }}
    >
      <Suspense
        fallback={
          <DashboardModalDialog
            aria-label="Pick image"
            variant="explorer"
            isLoading
          />
        }
      >
        <PickRichTextImageExplorerContent picker={picker} />
      </Suspense>
    </DashboardModal>
  )
}

function PickRichTextImageExplorerContent({picker}: PickTextLinkProps) {
  const options = picker.options
  const dashboard = useDashboard()
  const config = useAtomValue(dashboard.config)
  const workspace = useAtomValue(dashboard.selectedWorkspace)
  const mediaRoot = useAtomValue(dashboard.selectedMediaRoot)
  const initialImage = options.link
  const initialEntryId = imageReferenceEntryId(initialImage)
  const initialSelection = initialEntryId ? [initialEntryId] : []
  const location = {
    workspace,
    root: mediaRoot ?? undefined
  }
  const [explorer] = useState(() =>
    dashboard.explore(location, richTextImageExplorerOptions(initialSelection))
  )
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectionIds =
    selection === 'all'
      ? []
      : Array.from(selection).filter((id): id is string => {
          return typeof id === 'string'
        })
  const selectedId = selectionIds.at(0)
  const selectedItems = selection === 'all' ? 0 : selection.size
  const selectedEntry =
    typeof selectedId === 'string' ? dashboard.entries(selectedId) : undefined
  const selectedEntryState = useAtomValue(
    selectedEntry?.data ?? emptyEntryState
  )
  const imageInfo = useAtomValue(
    selectedEntryState.data?.fileInfoState ?? emptyImageState
  )

  function onSubmit() {
    if (!selectedId) return
    const link: RichTextImageReference = {
      [Reference.id]: initialImage?._id ?? createId(),
      [Reference.type]: 'image',
      _entry: selectedId
    }
    picker.confirm({
      link,
      height: imageInfo.data?.height,
      src: mediaLiveUrl(config, imageInfo.data?.location),
      width: imageInfo.data?.width
    })
    startTransition(() => {
      onConfirm()
    })
  }

  return (
    <DashboardModalDialog aria-label="Pick image" variant="explorer">
      <ExplorerModalSuspense>
        <ExplorerModal>
          <ExplorerHeader
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
          />
          <ExplorerPickerContent
            explorer={explorer}
            navigationLabel="Media folders"
            options={richTextImageExplorerOptions(initialSelection)}
          />
          <ExplorerModalFooter>
            <ExplorerModalSelection>
              {selectedItems} {selectedItems === 1 ? 'item' : 'items'} selected
            </ExplorerModalSelection>
            <ExplorerModalActions>
              <Button onPress={picker.cancel}>Cancel</Button>
              <Button
                intent="primary"
                isDisabled={!selectedId}
                onPress={onSubmit}
              >
                Select
              </Button>
            </ExplorerModalActions>
          </ExplorerModalFooter>
        </ExplorerModal>
      </ExplorerModalSuspense>
    </DashboardModalDialog>
  )
}

const emptyImageState = atom({
  pending: false,
  data: null
})

const emptyEntryState = atom<DashboardEntryState>({
  pending: false,
  data: undefined,
  error: undefined
})

const imageCondition = {
  or: [
    {
      _type: 'MediaFile',
      extension: {
        in: [
          ...imageExtensions,
          ...imageExtensions.map(extension => extension.toUpperCase())
        ]
      }
    },
    {_type: 'MediaLibrary'}
  ]
}

function richTextImageExplorerOptions(
  initialSelection: Array<string>
): ExplorerOptions {
  return {
    condition: imageCondition,
    enableNavigation: true,
    initialSelection,
    searchDepth: 'all',
    selectionMode: 'single',
    selectionBehavior: 'replace',
    onConfirm() {}
  }
}

function imageReferenceEntryId(reference: Reference | undefined) {
  if (!reference || reference._type !== 'image') return
  if (!('_entry' in reference)) return
  const entry = reference._entry
  return typeof entry === 'string' ? entry : undefined
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
