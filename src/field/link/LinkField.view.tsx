import {
  Button,
  Dialog,
  DialogTrigger,
  type DragMoveEvent,
  Field,
  Icon,
  SortableList,
  SortableListItemTitle,
  SortableListItemTrigger,
  SortableListAdd,
  SortableListDragPreview,
  ListError,
  ListLabel,
  SortableListItem,
  SortableListItemActions,
  SortableListItemContent,
  SortableListItemDescription,
  SortableListHandle,
  SortableListItemToggle,
  SortableListItemFooter,
  SortableListItemHeader,
  Kbd,
  Select,
  SelectItem,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetTitle,
  TextField
} from '#/components.js'
import {Config} from '#/core/Config.js'
import type {Entry as EntryRecord} from '#/core/Entry.js'
import type {Filter} from '#/core/Filter.js'
import {createId} from '#/core/Id.js'
import {getType, getWorkspace} from '#/core/Internal.js'
import type {Picker} from '#/core/Picker.js'
import {Reference} from '#/core/Reference.js'
import {Root} from '#/core/Root.js'
import {Type} from '#/core/Type.js'
import {Badge} from '#/components.js'
import {
  BlockSheet,
  type BlockSheetState,
  useBlockSheet
} from '#/dashboard/app/BlockSheet.js'
import {CompactRecordFields} from '#/dashboard/app/CompactField.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {configAtom, graphAtom} from '#/dashboard/atoms/core.js'
import {linkEntryAtoms, type LinkEntrySummary} from '#/dashboard/atoms/link.js'
import {
  ExternalLinkPicker,
  type ExternalLinkValue
} from '#/dashboard/app/ExternalLinkPicker.js'
import {ImagePicker} from '#/dashboard/app/ImagePicker.js'
import {
  LinkPicker,
  LinkPickerModal,
  type LinkPickerOptions
} from '#/dashboard/app/LinkPicker.js'
import {nav} from '#/dashboard/atoms/nav.js'
import {
  useEntry,
  useField,
  useFieldError,
  useFieldNode,
  useFieldOptions,
  useNodes,
  useOptionalEntryAtoms
} from '#/dashboard/hooks.js'
import {
  IcRoundAttachFile,
  IcRoundAdd,
  IcRoundClose,
  IcRoundDelete,
  IcRoundEdit,
  IcRoundLink,
  IcRoundOpenInNew,
  IcRoundPanorama
} from '#/dashboard/icons.js'
import {type LinkRow as LinkFieldRow} from '#/field/link.js'
import {LinkField, LinksField} from '#/field/link/LinkField.js'
import type {EditorLocation, EntryPickerOptions} from '#/picker/entry.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw, useAtomValueRawSync, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {
  ComponentPropsWithoutRef,
  ComponentType,
  ReactNode,
  RefObject
} from 'react'
import {useId, useMemo, useRef, useState} from 'react'
import css from './LinkField.module.css'

const styles = styler(css)

type PickerType = 'entry' | 'url' | 'file' | 'image'
type EntryPickerType = Exclude<PickerType, 'url'>
const LINK_FIELD_ROW_DRAG_TYPE = 'application/x-alinea-link-field-row'

interface LinkRowTextProps {
  node: ReactiveNode<LinkFieldRow>
}

function LinkRowText({node}: LinkRowTextProps) {
  const type = useAtomValueRaw(node.field('_type')) as string | undefined
  if (type === 'entry' || type === 'image' || type === 'file')
    return <EntryRowLayer node={node} textOnly />
  if (type === 'url') return <UrlRow node={node} textOnly />
  return null
}

function isPickerType(type: string): type is PickerType {
  return (
    type === 'entry' || type === 'url' || type === 'file' || type === 'image'
  )
}

function isLinkFieldRow(value: unknown): value is LinkFieldRow {
  if (!value || typeof value !== 'object') return false
  const type = (value as Partial<Record<typeof Reference.type, unknown>>)[
    Reference.type
  ]
  return typeof type === 'string' && isPickerType(type)
}

function getPickerType(type: string): PickerType {
  return isPickerType(type) ? type : 'entry'
}

function getEntryPickerType(type: PickerType): EntryPickerType {
  return type === 'url' ? 'entry' : type
}

interface RowLayerProps {
  hasFields?: boolean
  node: ReactiveNode<LinkFieldRow>
  textOnly?: boolean
}

function EntryRowLayer({hasFields, node, textOnly}: RowLayerProps) {
  const entryId = useAtomValueRaw(node.field('_entry')) as string | undefined
  const locale = useAtomValueRaw(node.field('_locale')) as string | undefined
  const type = useAtomValueRaw(node.field('_type')) as string | undefined
  if (!entryId) return null
  return (
    <EntryRow
      entryId={entryId}
      locale={locale}
      hasFields={hasFields}
      image={type === 'image'}
      textOnly={textOnly}
    />
  )
}

interface EntryRowProps {
  entryId: string
  locale?: string
  hasFields?: boolean
  image?: boolean
  textOnly?: boolean
}

function EntryRow({
  entryId,
  locale,
  hasFields,
  image,
  textOnly
}: EntryRowProps) {
  const state = useLinkEntryState(entryId, locale)
  if (state.state === 'hasData' && state.data)
    return (
      <LoadedEntryRow
        entry={state.data}
        hasFields={hasFields}
        image={image}
        textOnly={textOnly}
      />
    )
  if (state.state !== 'loading')
    return (
      <MissingEntryRow
        entryId={entryId}
        hasFields={hasFields}
        image={image}
        textOnly={textOnly}
      />
    )
  return (
    <EntryLoadingRow
      hasFields={hasFields}
      image={image}
      pending={true}
      textOnly={textOnly}
    />
  )
}

function useLinkEntryState(entryId: string, locale?: string) {
  const scope = useOptionalEntryAtoms()
  // Links stored without a locale follow the locale of the edited entry
  const linkLocale = locale ?? scope?.localeData.requestedLocale ?? undefined
  return useAtomValueRawSync(linkEntryAtoms(entryId, linkLocale))
}

interface EntryLoadingRowProps {
  hasFields?: boolean
  image?: boolean
  pending: boolean
  textOnly?: boolean
}

interface MissingEntryRowProps {
  entryId: string
  hasFields?: boolean
  image?: boolean
  textOnly?: boolean
}

function MissingEntryRow({
  entryId,
  hasFields,
  image,
  textOnly
}: MissingEntryRowProps) {
  return (
    <span className={styles.LinkFieldView.label({missing: true})}>
      {image && !textOnly && (
        <span
          className={styles.LinkFieldView.imagePlaceholder()}
          data-has-fields={hasFields ? 'true' : undefined}
          aria-hidden="true"
        />
      )}
      <span className={styles.LinkFieldView.labelText()}>
        <span className={styles.LinkFieldView.title()}>Missing entry</span>
        {!textOnly && (
          <span className={styles.LinkFieldView.meta()}>{entryId}</span>
        )}
      </span>
    </span>
  )
}

function EntryLoadingRow({
  hasFields,
  image,
  pending,
  textOnly
}: EntryLoadingRowProps) {
  return (
    <span
      className={styles.LinkFieldView.label({loading: true})}
      aria-busy={pending || undefined}
    >
      {image && !textOnly && (
        <span
          className={styles.LinkFieldView.imagePlaceholder()}
          data-has-fields={hasFields ? 'true' : undefined}
          aria-hidden="true"
        />
      )}
      <span className={styles.LinkFieldView.labelText()}>
        <span className={styles.LinkFieldView.skeleton({wide: true})} />
        <span className={styles.LinkFieldView.skeleton()} />
      </span>
    </span>
  )
}

interface LoadedEntryRowProps {
  entry: LinkEntrySummary
  hasFields?: boolean
  image?: boolean
  textOnly?: boolean
}

function LoadedEntryRow({
  entry,
  hasFields,
  image,
  textOnly
}: LoadedEntryRowProps) {
  return (
    <span className={styles.LinkFieldView.label()}>
      {image && !textOnly && (
        <EntryRowImage entry={entry} hasFields={hasFields} />
      )}
      <span className={styles.LinkFieldView.labelText()}>
        <span className={styles.LinkFieldView.title()}>{entry.title}</span>
        {entry.parents.length > 0 ? (
          <span className={styles.LinkFieldView.meta()}>
            <EntryParents parents={entry.parents} />
          </span>
        ) : null}
      </span>
    </span>
  )
}

interface EntryRowImageProps {
  entry: LinkEntrySummary
  hasFields?: boolean
}

function EntryRowImage({entry, hasFields}: EntryRowImageProps) {
  if (entry.preview) {
    return (
      <img
        alt=""
        className={styles.LinkFieldView.image()}
        data-has-fields={hasFields ? 'true' : undefined}
        src={entry.preview}
      />
    )
  }
  return null
}

function UrlRow({node, textOnly}: RowLayerProps) {
  const title = useAtomValueRaw(node.field('_title')) as string | undefined
  const url = useAtomValueRaw(node.field('_url')) as string | undefined
  return (
    <span className={styles.LinkFieldView.label()}>
      <span className={styles.LinkFieldView.title()}>
        {textOnly ? title || url : title || url}
      </span>
      {!textOnly && title && url && (
        <span className={styles.LinkFieldView.meta()}>{url}</span>
      )}
    </span>
  )
}

interface EntryParentsProps {
  parents: LinkEntrySummary['parents']
}

function EntryParents({parents}: EntryParentsProps) {
  return (
    <>
      {parents.map((parent, index) => (
        <span key={parent.id}>
          {parent.title}
          {index < parents.length - 1 ? ' / ' : ''}
        </span>
      ))}
    </>
  )
}

function getLinkIcon(type: string) {
  if (type === 'url') return IcRoundOpenInNew
  if (type === 'file') return IcRoundAttachFile
  if (type === 'image') return IcRoundPanorama
  return IcRoundLink
}

interface StandardFieldActionProps {
  field: LinkField<LinkFieldRow, unknown>
}

interface LinkPickerActionProps {
  allowDuplicates?: boolean
  anchorRef?: RefObject<Element | null>
  ariaLabel?: string
  buttonIcon?: ComponentType
  children?: ReactNode
  className?: string
  isDisabled?: boolean
  picker: Picker<LinkFieldRow>
  selection?: Array<LinkFieldRow>
  type: PickerType
  value?: LinkFieldRow
  onPick: (value: LinkFieldRow) => void
  onPickMany?: (value: Array<LinkFieldRow>) => void
}

interface LinkPickerDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onPick: (value: LinkFieldRow) => void
  onPickMany?: (value: Array<LinkFieldRow>) => void
  picker: Picker<LinkFieldRow>
  selection?: Array<LinkFieldRow>
  type: PickerType
  value?: LinkFieldRow
}

function createEntryLink(
  type: PickerType,
  entryId: string,
  picker: Picker<LinkFieldRow>,
  locale: string | null
) {
  return {
    ...initialFields(picker),
    _id: createId(),
    _type: getEntryPickerType(type),
    _index: '',
    _entry: entryId,
    _locale: type === 'entry' ? (locale ?? undefined) : undefined
  } satisfies LinkFieldRow
}

function createUrlLink(
  value: {url: string; title: string; target: string},
  picker: Picker<LinkFieldRow>,
  current?: LinkFieldRow
) {
  return {
    ...(current ?? initialFields(picker)),
    _id: current?._id ?? createId(),
    _type: 'url',
    _index: current?._index ?? '',
    _url: value.url,
    _title: value.title,
    _target: value.target
  } satisfies LinkFieldRow
}

/**
 * A single link is not a list row: it is stored without an `_index` order key,
 * like links picked in 1.x were.
 */
function singleLink(link: LinkFieldRow): LinkFieldRow {
  const {_index, ...value} = link
  return value as LinkFieldRow
}

function initialFields(picker: Picker<LinkFieldRow>) {
  if (!picker.fields) return {}
  return Type.initialValue(picker.fields) as Record<string, unknown>
}

function LinkPickerAction({
  allowDuplicates = false,
  anchorRef,
  ariaLabel,
  buttonIcon,
  children,
  className,
  isDisabled,
  onPick,
  onPickMany,
  picker,
  selection,
  type,
  value
}: LinkPickerActionProps) {
  const currentEntry = useEntry()
  const config = useAtomValueRaw(configAtom)
  const selectedWorkspace = currentEntry?.workspace
  const selectedRoot = currentEntry?.root
  const selectedMediaRoot = mediaRoot(config, selectedWorkspace)
  const options = picker.options as Partial<EntryPickerOptions>
  const resolved = useResolvedEntryPickerOptions(options, type, currentEntry)
  if (type === 'url') {
    return (
      <Dialog>
        <DialogTrigger
          aria-label={ariaLabel}
          variant="outline"
          className={className}
          icon={buttonIcon}
          disabled={isDisabled}
        >
          {children}
        </DialogTrigger>
        <ExternalLinkPicker
          key={value?._id ?? 'new'}
          initialValue={externalLinkValue(value)}
          selectionMode="single"
          submitLabel={value ? 'Save link' : undefined}
          onConfirm={link => onPick(createUrlLink(link, picker, value))}
        />
      </Dialog>
    )
  }
  const childLocation =
    options.pickChildren && currentEntry
      ? {
          workspace: currentEntry.workspace,
          root: currentEntry.root,
          parentId: currentEntry.id,
          locale: currentEntry.locale
        }
      : undefined
  const pickingChildren = Boolean(childLocation)
  const fallbackRoot =
    type === 'file' || type === 'image' ? selectedMediaRoot : selectedRoot
  const fallbackLocation =
    selectedWorkspace && fallbackRoot
      ? {workspace: selectedWorkspace, root: fallbackRoot}
      : undefined
  const location = childLocation ?? resolved.location ?? fallbackLocation
  const condition = resolved.condition
  const handlesMultiple = Boolean(onPickMany && picker.handlesMultiple)
  const pickerProps: LinkPickerOptions = {
    condition,
    enableNavigation: options.enableNavigation,
    initialView:
      type === 'file' || type === 'image' ? ('card' as const) : undefined,
    initialResultMode: entryPickerResultMode(
      type,
      condition,
      options.enableNavigation,
      pickingChildren
    ),
    initialSearchScope: entryPickerSearchScope(
      condition,
      resolved.location,
      options.enableNavigation,
      type
    ),
    location,
    limitLocations: options.limitLocations,
    nestedNavigation: !pickingChildren,
    pickChildren: pickingChildren,
    preselect: handlesMultiple && !allowDuplicates,
    selectionMode: handlesMultiple ? 'multiple' : 'single',
    selectionBehavior: handlesMultiple ? 'toggle' : 'replace',
    initialSelection: initialSelection(value, selection),
    onConfirm(entryIds: Array<string>, locale: string | null) {
      const existing = allowDuplicates ? [] : selection
      const links = entryIds.map(entryId => {
        const current = existing?.find(
          row => '_entry' in row && row._entry === entryId
        )
        if (!current) return createEntryLink(type, entryId, picker, locale)
        return {
          ...current,
          _locale: type === 'entry' ? (locale ?? undefined) : undefined
        }
      })
      if (onPickMany) return onPickMany(links)
      const [link] = links
      if (link) onPick(link)
    }
  } as const
  if (type === 'file' || type === 'image') {
    return (
      <Dialog>
        <DialogTrigger
          aria-label={ariaLabel}
          variant="outline"
          className={className}
          icon={buttonIcon}
          disabled={isDisabled}
        >
          {children}
        </DialogTrigger>
        <ImagePicker
          {...pickerProps}
          label={type === 'file' ? 'Pick a file' : 'Pick an image'}
        />
      </Dialog>
    )
  }
  return (
    <Dialog>
      <DialogTrigger
        aria-label={ariaLabel}
        variant="outline"
        className={className}
        icon={buttonIcon}
        disabled={isDisabled}
      >
        {children}
      </DialogTrigger>
      <LinkPicker {...pickerProps} anchorRef={anchorRef} />
    </Dialog>
  )
}

function LinkPickerDialog({
  isOpen,
  onOpenChange,
  onPick,
  onPickMany,
  picker,
  selection,
  type,
  value
}: LinkPickerDialogProps) {
  const currentEntry = useEntry()
  const config = useAtomValueRaw(configAtom)
  const selectedWorkspace = currentEntry?.workspace
  const selectedRoot = currentEntry?.root
  const selectedMediaRoot = mediaRoot(config, selectedWorkspace)
  const options = picker.options as Partial<EntryPickerOptions>
  const resolved = useResolvedEntryPickerOptions(options, type, currentEntry)

  function handlePick(link: LinkFieldRow) {
    onPick(link)
    onOpenChange(false)
  }

  if (type === 'url') {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <ExternalLinkPicker
          key={value?._id ?? 'new'}
          initialValue={externalLinkValue(value)}
          selectionMode="single"
          submitLabel={value ? 'Save link' : undefined}
          onConfirm={link => handlePick(createUrlLink(link, picker, value))}
        />
      </Dialog>
    )
  }
  const childLocation =
    options.pickChildren && currentEntry
      ? {
          workspace: currentEntry.workspace,
          root: currentEntry.root,
          parentId: currentEntry.id
        }
      : undefined
  const pickingChildren = Boolean(childLocation)
  const fallbackRoot =
    type === 'file' || type === 'image' ? selectedMediaRoot : selectedRoot
  const fallbackLocation =
    selectedWorkspace && fallbackRoot
      ? {workspace: selectedWorkspace, root: fallbackRoot}
      : undefined
  const location = childLocation ?? resolved.location ?? fallbackLocation
  const condition = resolved.condition
  const handlesMultiple = Boolean(onPickMany && picker.handlesMultiple)
  const pickerProps: LinkPickerOptions = {
    condition,
    enableNavigation: options.enableNavigation,
    initialView:
      type === 'file' || type === 'image' ? ('card' as const) : undefined,
    initialResultMode: entryPickerResultMode(
      type,
      condition,
      options.enableNavigation,
      pickingChildren
    ),
    initialSearchScope: entryPickerSearchScope(
      condition,
      resolved.location,
      options.enableNavigation,
      type
    ),
    location,
    limitLocations: options.limitLocations,
    nestedNavigation: !pickingChildren,
    pickChildren: pickingChildren,
    preselect: false,
    selectionMode: handlesMultiple ? 'multiple' : 'single',
    selectionBehavior: handlesMultiple ? 'toggle' : 'replace',
    initialSelection: initialSelection(value, selection),
    onConfirm(selection: Array<string>, locale: string | null) {
      const links = selection.map(entryId =>
        createEntryLink(type, entryId, picker, locale)
      )
      if (onPickMany) {
        onPickMany(links)
        onOpenChange(false)
        return
      }
      const [link] = links
      if (link) handlePick(link)
    }
  } as const
  if (type === 'file' || type === 'image') {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <ImagePicker
          {...pickerProps}
          label={type === 'file' ? 'Pick a file' : 'Pick an image'}
        />
      </Dialog>
    )
  }
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <LinkPickerModal {...pickerProps} />
    </Dialog>
  )
}

interface ResolvedEntryPickerOptions {
  condition: Filter | undefined
  location: EditorLocation | undefined
}

function useResolvedEntryPickerOptions(
  options: Partial<EntryPickerOptions>,
  type: PickerType,
  entry: EntryRecord<Record<string, unknown>> | null
): ResolvedEntryPickerOptions {
  const {condition: conditionOption, location: locationOption} = options
  const resolvedAtom = useMemo(() => {
    const initialValue: ResolvedEntryPickerOptions = {
      condition:
        typeof conditionOption === 'function' ? undefined : conditionOption,
      location:
        typeof locationOption === 'function' ? undefined : locationOption
    }
    const resolved = atom(async get => {
      if (type === 'url') return {condition: undefined, location: undefined}
      if (!entry) return initialValue
      const info = {entry, graph: get(graphAtom)}
      const condition =
        typeof conditionOption === 'function'
          ? conditionOption(info)
          : conditionOption
      const location =
        typeof locationOption === 'function'
          ? locationOption(info)
          : locationOption
      const [nextCondition, nextLocation] = await Promise.all([
        condition,
        location
      ])
      return {condition: nextCondition, location: nextLocation}
    })
    return unwrap(resolved, previous => previous ?? initialValue)
  }, [conditionOption, entry, locationOption, type])
  return useAtomValueRawSync(resolvedAtom)
}

function entryPickerSearchScope(
  condition: Filter | undefined,
  location: EditorLocation | undefined,
  enableNavigation: boolean | undefined,
  type: PickerType
) {
  if (type === 'file' || type === 'image') return 'workspace' as const
  return condition && !location && enableNavigation !== true
    ? ('everything' as const)
    : ('workspace' as const)
}

function entryPickerResultMode(
  type: PickerType,
  condition: Filter | undefined,
  enableNavigation: boolean | undefined,
  pickChildren: boolean
) {
  if (type === 'file' || type === 'image') return 'browse' as const
  return pickChildren || (condition && enableNavigation !== true)
    ? ('matches' as const)
    : ('browse' as const)
}

function externalLinkValue(
  value?: LinkFieldRow
): ExternalLinkValue | undefined {
  if (value?.[Reference.type] !== 'url') return undefined
  return {
    url: value._url,
    title: value._title,
    target: value._target
  }
}

function initialSelection(
  value?: LinkFieldRow,
  selection: Array<LinkFieldRow> = []
): Array<string> {
  if (value && '_entry' in value) return [value._entry]
  return selection.flatMap(row => ('_entry' in row ? [row._entry] : []))
}

function mediaRoot(config: Config, workspaceName?: string): string | undefined {
  if (!workspaceName) return undefined
  const workspace = config.workspaces[workspaceName]
  if (!workspace) return undefined
  return Object.entries(getWorkspace(workspace).roots).find(([, root]) =>
    Root.isMediaRoot(root)
  )?.[0]
}

function insertIndex(rowIndex: number, position: 'before' | 'after'): number {
  return position === 'before' ? rowIndex : rowIndex + 1
}

function reorderIndex(fromIndex: number, targetIndex: number): number {
  return fromIndex < targetIndex ? targetIndex - 1 : targetIndex
}

interface SingleLinkCreateActionsProps extends StandardFieldActionProps {
  value?: LinkFieldRow
}

function SingleLinkCreateActions({field, value}: SingleLinkCreateActionsProps) {
  const options = useFieldOptions(field)
  const [, setValue] = useField(field)
  const anchorRef = useRef<HTMLDivElement>(null)
  if (options.readOnly) return null
  return (
    <div className={styles.LinkFieldView.create()} ref={anchorRef}>
      {Object.entries(options.pickers).map(([type, picker]) => (
        <LinkPickerAction
          anchorRef={anchorRef}
          buttonIcon={options.isEntryField ? IcRoundAdd : getLinkIcon(type)}
          className={styles.LinkFieldView.createButton()}
          key={type}
          onPick={link => setValue(singleLink(link))}
          picker={picker as Picker<LinkFieldRow>}
          type={type as PickerType}
          value={value?._type === type ? value : undefined}
        >
          {options.isEntryField ? options.label : picker.label}
        </LinkPickerAction>
      ))}
    </div>
  )
}

interface MultipleLinkCreateActionsProps {
  field: LinksField<LinkFieldRow, unknown>
}

function MultipleLinkCreateActions({field}: MultipleLinkCreateActionsProps) {
  const options = useFieldOptions(field)
  const [value, setValue] = useField(field)
  const anchorRef = useRef<HTMLDivElement>(null)
  const links = value ?? []
  const showCreate = options.max ? links.length < options.max : true
  if (options.readOnly) return null
  if (!showCreate) return null
  return (
    <div className={styles.LinkFieldView.create()} ref={anchorRef}>
      {Object.entries(options.pickers).map(([type, picker]) => (
        <LinkPickerAction
          allowDuplicates={options.allowDuplicates}
          anchorRef={anchorRef}
          buttonIcon={options.isEntryField ? IcRoundAdd : getLinkIcon(type)}
          className={styles.LinkFieldView.createButton()}
          key={type}
          onPick={link => {
            setValue(links => [...(links ?? []), link])
          }}
          onPickMany={picked =>
            setValue(value => {
              const current = value ?? []
              if (options.allowDuplicates) return [...current, ...picked]
              const pickedIds = new Set(picked.map(row => row._id))
              const currentIds = new Set(current.map(row => row._id))
              return [
                ...current.filter(
                  row => row._type !== type || pickedIds.has(row._id)
                ),
                ...picked.filter(row => !currentIds.has(row._id))
              ]
            })
          }
          picker={picker as Picker<LinkFieldRow>}
          selection={links.filter(row => row._type === type)}
          type={type as PickerType}
        >
          {options.isEntryField ? options.label : picker.label}
        </LinkPickerAction>
      ))}
    </div>
  )
}

interface LinkRowEditorProps {
  node: ReactiveNode<LinkFieldRow>
  picker?: Picker<LinkFieldRow>
}

function LinkRowEditor({node, picker}: LinkRowEditorProps) {
  if (!picker?.fields) return null
  return <NodeEditor node={node as ReactiveNode<object>} type={picker.fields} />
}

interface SingleLinkRowProps extends StandardFieldActionProps {
  node: ReactiveNode<LinkFieldRow>
  value: LinkFieldRow
}

interface LinkRowActionsProps {
  closeActions: () => void
  isDisabled?: boolean
  picker?: Picker<LinkFieldRow>
  type: PickerType
  value: LinkFieldRow
  onEdit: () => void
}

function LinkRowActions({
  closeActions,
  isDisabled,
  picker,
  type,
  value,
  onEdit
}: LinkRowActionsProps) {
  return (
    <>
      <LinkRowReferenceActions
        closeActions={closeActions}
        type={type}
        value={value}
      />
      {picker && (
        <Button
          aria-label="Replace link"
          variant="ghost"
          size="sm"
          icon={IcRoundEdit}
          disabled={isDisabled}
          onClick={() => {
            closeActions()
            onEdit()
          }}
        >
          Replace link
        </Button>
      )}
    </>
  )
}

interface LinkLabelFieldProps {
  isDisabled?: boolean
  node: ReactiveNode<LinkFieldRow>
  value: LinkFieldRow
}

function LinkLabelField({isDisabled, node, value}: LinkLabelFieldProps) {
  const customLabel = useAtomValueRaw(node.field('_label')) as
    | string
    | undefined
  const setCustomLabel = useSetAtom(node.field('_label'))
  if ('_entry' in value) {
    return (
      <EntryLinkLabelField
        customLabel={customLabel}
        entryId={value._entry}
        locale={value._locale}
        isDisabled={isDisabled}
        onChange={setCustomLabel}
      />
    )
  }
  return (
    <ResolvedLinkLabelField
      customLabel={customLabel}
      isDisabled={isDisabled}
      onChange={setCustomLabel}
    />
  )
}

interface EntryLinkSuffixFieldProps {
  isDisabled?: boolean
  node: ReactiveNode<LinkFieldRow>
  value: LinkFieldRow
}

function EntryLinkSuffixField({
  isDisabled,
  node,
  value
}: EntryLinkSuffixFieldProps) {
  const suffix = useAtomValueRaw(node.field('_suffix')) as string | undefined
  const setSuffix = useSetAtom(node.field('_suffix'))
  if (value[Reference.type] !== 'entry') return null
  return (
    <TextField
      description="E.g. ?s=search"
      disabled={isDisabled}
      label="URL suffix"
      onValueChange={next => setSuffix(next || undefined)}
      value={suffix ?? ''}
    />
  )
}

interface EntryAnchorFieldProps {
  isDisabled?: boolean
  node: ReactiveNode<LinkFieldRow>
  value: LinkFieldRow
}

function EntryAnchorField({isDisabled, node, value}: EntryAnchorFieldProps) {
  const anchor = useAtomValueRaw(node.field('_anchor')) as string | undefined
  const setAnchor = useSetAtom(node.field('_anchor'))
  if (value[Reference.type] !== 'entry') return null
  return (
    <EntryAnchorFieldInner
      anchor={anchor}
      entryId={value._entry}
      locale={value._locale}
      isDisabled={isDisabled}
      onChange={setAnchor}
    />
  )
}

function EntryAnchorBadge({node, value}: EntryAnchorFieldProps) {
  const anchor = useAtomValueRaw(node.field('_anchor')) as string | undefined
  if (value[Reference.type] !== 'entry' || !anchor) return null
  return <Badge size="sm">#{anchor}</Badge>
}

interface EntryAnchorFieldInnerProps {
  anchor?: string
  entryId: string
  locale?: string
  isDisabled?: boolean
  onChange(value: string | undefined): void
}

function EntryAnchorFieldInner({
  anchor,
  entryId,
  locale,
  isDisabled,
  onChange
}: EntryAnchorFieldInnerProps) {
  const state = useLinkEntryState(entryId, locale)
  const anchors = state.state === 'hasData' ? (state.data?.anchors ?? []) : []
  return (
    <Select
      disabled={isDisabled || anchors.length === 0}
      label="Anchor"
      onValueChange={next => onChange(next ?? undefined)}
      value={anchor ?? null}
    >
      {anchors.map(item => (
        <SelectItem
          key={item.id}
          value={item.id}
          textValue={item.label ?? `#${item.id}`}
        >
          <span className={styles.LinkFieldView.anchorOption()}>
            <span className={styles.LinkFieldView.anchorOption.label()}>
              {item.label ?? `#${item.id}`}
            </span>
            <span className={styles.LinkFieldView.anchorOption.location()}>
              {item.fieldLabel ?? item.fieldPath}
            </span>
          </span>
        </SelectItem>
      ))}
    </Select>
  )
}

interface LinkMetaLabelProps {
  node: ReactiveNode<LinkFieldRow>
  value: LinkFieldRow
}

function LinkMetaLabel({node, value}: LinkMetaLabelProps) {
  return (
    <LinkLabel node={node} value={value}>
      {label =>
        label && (
          <SortableListItemDescription
            className={styles.LinkFieldView.metaLabel()}
          >
            {label}
          </SortableListItemDescription>
        )
      }
    </LinkLabel>
  )
}

interface LinkLabelProps {
  node: ReactiveNode<LinkFieldRow>
  value: LinkFieldRow
  children: (label: string | undefined) => ReactNode
}

/** The label of a link: its custom label, the linked title or the url */
function LinkLabel({node, value, children}: LinkLabelProps) {
  const customLabel = useAtomValueRaw(node.field('_label')) as
    | string
    | undefined
  if ('_entry' in value)
    return (
      <EntryLinkLabel
        customLabel={customLabel}
        entryId={value._entry}
        locale={value._locale}
      >
        {children}
      </EntryLinkLabel>
    )
  return children(trimmed(customLabel || linkFallbackLabel(value)))
}

function linkFallbackLabel(value: LinkFieldRow): string | undefined {
  if ('_title' in value && value._title) return value._title
  if ('_url' in value && value._url) return value._url
  return undefined
}

function trimmed(label: string | undefined) {
  return label?.trim() || undefined
}

interface EntryLinkLabelProps {
  customLabel?: string
  entryId: string
  locale?: string
  children: (label: string | undefined) => ReactNode
}

function EntryLinkLabel({
  customLabel,
  entryId,
  locale,
  children
}: EntryLinkLabelProps) {
  const state = useLinkEntryState(entryId, locale)
  const title = state.state === 'hasData' ? state.data?.title : undefined
  return children(trimmed(customLabel ?? title))
}

interface LinkTypeBadgeProps extends ComponentPropsWithoutRef<'span'> {
  picker?: Picker<LinkFieldRow>
  type: PickerType
  value: LinkFieldRow
}

function LinkTypeBadge({picker, type, value, ...props}: LinkTypeBadgeProps) {
  const fallbackIcon = getLinkIcon(type)
  const fallbackLabel = picker?.label ?? type
  if (type === 'image') {
    return (
      <Badge {...props} icon={IcRoundPanorama} size="sm">
        Image
      </Badge>
    )
  }
  if (type === 'file') {
    return (
      <Badge {...props} icon={IcRoundAttachFile} size="sm">
        File
      </Badge>
    )
  }
  if ('_entry' in value) {
    return (
      <EntryLinkTypeBadge
        {...props}
        entryId={value._entry}
        locale={value._locale}
        fallbackIcon={fallbackIcon}
        fallbackLabel={fallbackLabel}
      />
    )
  }
  return (
    <Badge {...props} icon={fallbackIcon} size="sm">
      {fallbackLabel}
    </Badge>
  )
}

interface EntryLinkImagePreviewProps {
  entryId: string
}

function EntryLinkImagePreview({entryId}: EntryLinkImagePreviewProps) {
  const state = useLinkEntryState(entryId)
  if (state.state !== 'hasData' || !state.data?.preview)
    return <span className={styles.LinkFieldView.previewImagePlaceholder()} />
  return (
    <img
      alt=""
      className={styles.LinkFieldView.previewImage()}
      src={state.data.preview}
    />
  )
}

interface EntryLinkTypeBadgeProps extends ComponentPropsWithoutRef<'span'> {
  entryId: string
  locale?: string
  fallbackIcon: ComponentType
  fallbackLabel: string
}

function EntryLinkTypeBadge({
  entryId,
  locale,
  fallbackIcon,
  fallbackLabel,
  ...props
}: EntryLinkTypeBadgeProps) {
  const state = useLinkEntryState(entryId, locale)
  const config = useAtomValueRaw(configAtom)
  const entry = state.state === 'hasData' ? state.data : undefined
  const type = entry ? config.schema[entry.type] : undefined
  if (!type) {
    return (
      <Badge {...props} icon={fallbackIcon} size="sm">
        {fallbackLabel}
      </Badge>
    )
  }
  return (
    <Badge
      {...props}
      className={styles.LinkFieldView.type(
        styler.merge({className: props.className})
      )}
      icon={getType(type).icon || IcRoundLink}
      size="sm"
    >
      {Type.label(type)}
    </Badge>
  )
}

interface EntryLinkLabelFieldProps {
  customLabel?: string
  entryId: string
  locale?: string
  isDisabled?: boolean
  onChange: (value: string | undefined) => void
}

function EntryLinkLabelField({
  customLabel,
  entryId,
  locale,
  isDisabled,
  onChange
}: EntryLinkLabelFieldProps) {
  const state = useLinkEntryState(entryId, locale)
  return (
    <ResolvedLinkLabelField
      customLabel={customLabel}
      fallbackLabel={state.state === 'hasData' ? state.data?.title : undefined}
      isDisabled={isDisabled}
      onChange={onChange}
    />
  )
}

interface ResolvedLinkLabelFieldProps {
  customLabel?: string
  fallbackLabel?: string
  isDisabled?: boolean
  onChange: (value: string | undefined) => void
}

function ResolvedLinkLabelField({
  customLabel,
  fallbackLabel = '',
  isDisabled,
  onChange
}: ResolvedLinkLabelFieldProps) {
  return (
    <TextField
      disabled={isDisabled}
      label="Label"
      onValueChange={onChange}
      value={customLabel ?? fallbackLabel}
    />
  )
}

interface LinkRowReferenceActionsProps {
  closeActions: () => void
  type: PickerType
  value: LinkFieldRow
}

function LinkRowReferenceActions({
  closeActions,
  type,
  value
}: LinkRowReferenceActionsProps) {
  if ('_url' in value)
    return <UrlLinkRowAction closeActions={closeActions} url={value._url} />
  if (!('_entry' in value)) return null
  return (
    <EntryLinkRowActions
      closeActions={closeActions}
      entryId={value._entry}
      locale={value._locale}
      type={type}
    />
  )
}

interface UrlLinkRowActionProps {
  closeActions: () => void
  url?: string
}

/** Opens an external link in a new tab, relative urls on the site */
function UrlLinkRowAction({closeActions, url}: UrlLinkRowActionProps) {
  const config = useAtomValueRaw(configAtom)
  const href = openableUrl(url, Config.baseUrl(config) ?? window.location.href)
  return (
    <Button
      aria-label="Open link"
      variant="ghost"
      size="sm"
      icon={IcRoundOpenInNew}
      disabled={!href}
      onClick={() => {
        if (href) window.open(href, '_blank', 'noopener,noreferrer')
        closeActions()
      }}
    >
      Open link
    </Button>
  )
}

const openableProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/** The absolute url of a link, unless it would run script like javascript: */
function openableUrl(url: string | undefined, base: string) {
  if (!url) return undefined
  const parsed = URL.parse(url, base)
  return parsed && openableProtocols.has(parsed.protocol)
    ? parsed.href
    : undefined
}

interface EntryLinkRowActionsProps {
  closeActions: () => void
  entryId: string
  locale?: string
  type: PickerType
}

function EntryLinkRowActions({
  closeActions,
  entryId,
  locale,
  type
}: EntryLinkRowActionsProps) {
  const scope = useOptionalEntryAtoms()
  const state = useLinkEntryState(entryId, locale)
  if (state.state !== 'hasData' || !state.data) {
    return (
      <Button
        aria-label="Open link"
        variant="ghost"
        size="sm"
        icon={IcRoundOpenInNew}
        disabled
      >
        Open link
      </Button>
    )
  }
  const entry = state.data
  const linkLocale =
    type === 'entry' ? (locale ?? scope?.localeData.requestedLocale) : undefined
  const href = `#${nav.entry(entry.workspace, entry.root, entry.id, linkLocale)}`
  return (
    <Button
      aria-label="Open link"
      variant="ghost"
      size="sm"
      icon={IcRoundOpenInNew}
      onClick={() => {
        window.open(href, '_blank', 'noopener,noreferrer')
        closeActions()
      }}
    >
      Open link
    </Button>
  )
}

interface LinkRowButtonProps {
  children: ReactNode
  sheet: BlockSheetState
  onEdit: () => void
}

/**
 * The content of a link row, which names it, opens its settings. Outside an
 * entry editor there are no settings, it replaces the link instead.
 */
function LinkRowButton({children, sheet, onEdit}: LinkRowButtonProps) {
  const descriptionId = useId()
  return (
    <SortableListItemTrigger
      aria-describedby={descriptionId}
      aria-expanded={sheet.available ? sheet.open : undefined}
      more={sheet.available}
      onClick={sheet.available ? sheet.toggle : onEdit}
    >
      {children}
      <span id={descriptionId} hidden>
        Edit link
      </span>
    </SortableListItemTrigger>
  )
}

interface LinkSheetProps {
  node: ReactiveNode<LinkFieldRow>
  onEdit: () => void
  onRemove: () => void
  picker?: Picker<LinkFieldRow>
  readOnly?: boolean
  sheet: BlockSheetState
  type: PickerType
  value: LinkFieldRow
}

function LinkSheet({
  node,
  onEdit,
  onRemove,
  picker,
  readOnly,
  sheet,
  type,
  value
}: LinkSheetProps) {
  const close = () => sheet.setOpen(false)
  return (
    <BlockSheet id={value[Reference.id]}>
      <SheetContent onClose={close}>
        <SheetHeader>
          <LinkTypeBadge picker={picker} type={type} value={value} />
          <SheetTitle>
            <LinkLabel node={node} value={value}>
              {label => label ?? 'Link'}
            </LinkLabel>
          </SheetTitle>
          <Kbd size="sm" aria-hidden>
            Esc
          </Kbd>
          <SheetClose aria-label="Close link settings" />
        </SheetHeader>
        <SheetBody>
          <SheetSection>
            <LinkLabelField isDisabled={readOnly} node={node} value={value} />
            <EntryAnchorField isDisabled={readOnly} node={node} value={value} />
            <EntryLinkSuffixField
              isDisabled={readOnly}
              node={node}
              value={value}
            />
          </SheetSection>
        </SheetBody>
        <SheetFooter>
          <LinkRowActions
            closeActions={close}
            isDisabled={readOnly}
            onEdit={onEdit}
            picker={picker}
            type={type}
            value={value}
          />
          <Button
            variant="ghost"
            size="sm"
            color="destructive"
            icon={IcRoundDelete}
            disabled={readOnly}
            onClick={onRemove}
          >
            Remove
          </Button>
        </SheetFooter>
      </SheetContent>
    </BlockSheet>
  )
}

function SingleLinkRow({field, node, value}: SingleLinkRowProps) {
  const [, setValue] = useField(field)
  const options = useFieldOptions(field)
  const type = getPickerType(value[Reference.type])
  const picker = options.pickers[type] as Picker<LinkFieldRow> | undefined
  const hasFields = Boolean(picker?.fields)
  const imagePreviewEntryId =
    type === 'image' && '_entry' in value ? value._entry : undefined
  const sheet = useBlockSheet(value[Reference.id])
  const [editOpen, setEditOpen] = useState(false)

  function removeLink() {
    setValue(undefined!)
  }

  const rowContent = (
    <>
      {imagePreviewEntryId && (
        <EntryLinkImagePreview entryId={imagePreviewEntryId} />
      )}
      {type !== 'image' && (
        <LinkTypeBadge
          className={styles.LinkFieldView.type()}
          picker={picker}
          type={type}
          value={value}
        />
      )}
      <LinkMetaLabel node={node} value={value} />
      <EntryAnchorBadge node={node} value={value} />
    </>
  )

  return (
    <>
      <SortableListItem aria-label="Link item 1" current={sheet.open}>
        <SortableListItemHeader>
          <SortableListItemTitle>
            {options.readOnly ? (
              rowContent
            ) : (
              <LinkRowButton sheet={sheet} onEdit={() => setEditOpen(true)}>
                {rowContent}
              </LinkRowButton>
            )}
          </SortableListItemTitle>
          {!options.readOnly && (
            <SortableListItemActions>
              <Button
                variant="ghost"
                aria-label="Remove link"
                icon={IcRoundClose}
                onClick={removeLink}
                size="icon-sm"
              />
            </SortableListItemActions>
          )}
        </SortableListItemHeader>
        {hasFields && (
          <SortableListItemContent>
            <LinkRowEditor node={node} picker={picker} />
          </SortableListItemContent>
        )}
      </SortableListItem>
      <LinkSheet
        node={node}
        onEdit={() => setEditOpen(true)}
        onRemove={removeLink}
        picker={picker}
        readOnly={options.readOnly}
        sheet={sheet}
        type={type}
        value={value}
      />
      {picker && (
        <LinkPickerDialog
          isOpen={editOpen}
          onOpenChange={setEditOpen}
          onPick={link => setValue(singleLink(link))}
          picker={picker}
          type={type}
          value={value}
        />
      )}
    </>
  )
}

interface MultipleLinkRowProps {
  expanded: boolean
  field: LinksField<LinkFieldRow, unknown>
  index: number
  node: ReactiveNode<LinkFieldRow>
  onToggleRow: (rowId: string) => void
  value: LinkFieldRow
}

function MultipleLinkRow({
  expanded,
  field,
  index,
  node,
  onToggleRow,
  value
}: MultipleLinkRowProps) {
  const [, setValue] = useField(field)
  const options = useFieldOptions(field)
  const type = getPickerType(value[Reference.type])
  const picker = options.pickers[type] as Picker<LinkFieldRow> | undefined
  const hasFields = Boolean(picker?.fields)
  const imagePreviewEntryId =
    type === 'image' && '_entry' in value ? value._entry : undefined
  const itemId = value[Reference.id]
  const readOnly = Boolean(options.readOnly)
  const sheet = useBlockSheet(value[Reference.id])
  const [editOpen, setEditOpen] = useState(false)

  function removeLink() {
    setValue(links => links.filter((_, currentIndex) => currentIndex !== index))
  }

  const rowContent = (
    <>
      {imagePreviewEntryId && (
        <EntryLinkImagePreview entryId={imagePreviewEntryId} />
      )}
      {type !== 'image' && (
        <LinkTypeBadge picker={picker} type={type} value={value} />
      )}
      <LinkMetaLabel node={node} value={value} />
      <EntryAnchorBadge node={node} value={value} />
    </>
  )

  return (
    <>
      <SortableListItem
        aria-label={`Link item ${index + 1}`}
        dragPreview={
          <SortableListDragPreview
            icon={getLinkIcon(type)}
            label={<LinkRowText node={node} />}
          />
        }
        id={itemId}
        current={sheet.open}
      >
        <SortableListItemHeader>
          {!readOnly && (
            <SortableListHandle aria-label={`Drag link item ${index + 1}`} />
          )}
          <SortableListItemTitle>
            {hasFields && (
              <SortableListItemToggle
                aria-label={expanded ? 'Collapse link' : 'Expand link'}
                expanded={expanded}
                onClick={() => onToggleRow(itemId)}
              />
            )}
            {readOnly ? (
              rowContent
            ) : (
              <LinkRowButton sheet={sheet} onEdit={() => setEditOpen(true)}>
                {rowContent}
              </LinkRowButton>
            )}
          </SortableListItemTitle>
          <SortableListItemActions>
            <Button
              variant="ghost"
              aria-label="Remove link"
              icon={IcRoundClose}
              disabled={readOnly}
              onClick={removeLink}
              size="icon-sm"
            />
          </SortableListItemActions>
        </SortableListItemHeader>
        {expanded && hasFields && (
          <SortableListItemContent>
            <LinkRowEditor node={node} picker={picker} />
          </SortableListItemContent>
        )}
        {!expanded && picker?.fields && (
          <SortableListItemFooter>
            <CompactRecordFields
              fields={Type.fields(picker.fields)}
              layout="footer"
              value={value}
            />
          </SortableListItemFooter>
        )}
      </SortableListItem>
      <LinkSheet
        node={node}
        onEdit={() => setEditOpen(true)}
        onRemove={removeLink}
        picker={picker}
        readOnly={readOnly}
        sheet={sheet}
        type={type}
        value={value}
      />
      {picker && (
        <LinkPickerDialog
          isOpen={editOpen}
          onOpenChange={setEditOpen}
          onPick={link => {
            setValue(links =>
              links.map((current, currentIndex) =>
                currentIndex === index ? link : current
              )
            )
          }}
          picker={picker}
          type={type}
          value={value}
        />
      )}
    </>
  )
}

export interface SingleLinkFieldViewProps {
  field: LinkField<LinkFieldRow, unknown>
}

export function SingleLinkFieldView({field}: SingleLinkFieldViewProps) {
  const [value] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const node = useFieldNode(field)
  const nodeIsEmpty = useAtomValueRaw(node.isEmpty)
  const selectedValue = isLinkFieldRow(value) ? value : undefined
  const isEmpty = nodeIsEmpty || !selectedValue
  const hasRows = Boolean(selectedValue)
  const readOnly = Boolean(options.readOnly)
  const picker =
    selectedValue &&
    options.pickers[getPickerType(selectedValue[Reference.type])]
  const content = (hasRows || !readOnly) && (
    <SortableList
      aria-label={options.label || 'Link'}
      className={styles.LinkFieldView.single({control: !picker?.fields})}
    >
      {selectedValue && (
        <SingleLinkRow
          field={field}
          node={node as ReactiveNode<LinkFieldRow>}
          value={selectedValue}
        />
      )}
      {isEmpty && !readOnly && (
        <SortableListAdd>
          <SingleLinkCreateActions field={field} />
        </SortableListAdd>
      )}
    </SortableList>
  )
  return (
    <Field
      description={options.help}
      label={options.inline ? undefined : options.label}
      required={options.required}
      error={error}
      shared={options.shared}
    >
      {content}
    </Field>
  )
}

export interface MultipleLinksFieldViewProps {
  field: LinksField<LinkFieldRow, unknown>
}

export function MultipleLinksFieldView({field}: MultipleLinksFieldViewProps) {
  const [value] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const list = useFieldNode<Array<LinkFieldRow>>(field)
  const links = value ?? []
  const nodes = useNodes(list) ?? []
  const readOnly = Boolean(options.readOnly)
  const hasRows = nodes.length > 0
  const hasFoldableRows = links.some(link => {
    const picker = options.pickers[getPickerType(link[Reference.type])] as
      | Picker<LinkFieldRow>
      | undefined
    return Boolean(picker?.fields)
  })
  const [foldedIds, setFoldedIds] = useState<Set<string>>(new Set())
  const rowIdsAtom = useMemo(
    () =>
      atom(get => {
        const nodes = get(list.nodes) as Array<ReactiveNode<LinkFieldRow>>
        return nodes.map(node => get(node.field('_id')) as string)
      }),
    [list]
  )
  const rowIds = useAtomValueRaw(rowIdsAtom)
  const moveRowAtom = useMemo(
    () =>
      atom(null, (get, set, {keys, target}: DragMoveEvent) => {
        const currentNodes = get(list.nodes) as Array<
          ReactiveNode<LinkFieldRow>
        >
        const ids = currentNodes.map(node => get(node.field('_id')))
        const [rowId] = keys
        const fromIndex = ids.indexOf(rowId)
        const targetRow = ids.indexOf(target.key)
        if (fromIndex === -1 || targetRow === -1) return
        const targetIndex = insertIndex(
          targetRow,
          target.position === 'before' ? 'before' : 'after'
        )
        const toIndex = reorderIndex(fromIndex, targetIndex)
        if (toIndex === fromIndex) return
        set(list.move, fromIndex, toIndex)
      }),
    [list]
  )
  const moveRow = useSetAtom(moveRowAtom)
  const allExpanded = nodes.length > 0 && foldedIds.size === 0

  function toggleAll() {
    setFoldedIds(allExpanded ? new Set(rowIds) : new Set())
  }

  function toggleRow(rowId: string) {
    setFoldedIds(current => {
      const next = new Set(current)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  const content = (hasRows || !readOnly) && (
    <SortableList
      aria-label={options.label || 'Links'}
      dragType={LINK_FIELD_ROW_DRAG_TYPE}
      onReorder={readOnly ? undefined : moveRow}
    >
      {nodes.map((node, index) => {
        const value = links[index]
        if (!value) return null
        return (
          <MultipleLinkRow
            key={value._id}
            expanded={!foldedIds.has(value._id)}
            field={field}
            index={index}
            node={node}
            onToggleRow={toggleRow}
            value={value}
          />
        )
      })}
      {!readOnly && (
        <SortableListAdd>
          <MultipleLinkCreateActions field={field} />
        </SortableListAdd>
      )}
    </SortableList>
  )

  return (
    <>
      <ListLabel
        required={options.required}
        aria-label={
          hasRows
            ? allExpanded
              ? 'Collapse all links'
              : 'Expand all links'
            : 'No links to fold'
        }
        expanded={allExpanded}
        hasRows={hasRows}
        disabled={!hasFoldableRows}
        onClick={toggleAll}
        description={options.help}
        shared={options.shared}
        showFold={!options.inline && hasFoldableRows}
        inline={options.inline}
      >
        {options.label}
      </ListLabel>
      {content}
      {error && <ListError>{error}</ListError>}
    </>
  )
}
