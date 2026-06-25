import {
  Button,
  DialogTrigger,
  Icon,
  List,
  ListCreateRow,
  ListDragPreview,
  ListLabel,
  ListRow,
  ListRowActions,
  ListRowBadges,
  ListRowBody,
  ListRowDrag,
  ListRowDragHandle,
  ListRowFoldButton,
  ListRowFooter,
  ListRowHeader,
  ListRowSettings,
  ListRowSettingsButton,
  MenuSeparator,
  Popover,
  TextField
} from '#/components.js'
import {createId} from '#/core/Id.js'
import type {Picker} from '#/core/Picker.js'
import {Reference} from '#/core/Reference.js'
import {Type} from '#/core/Type.js'
import {Badge} from '#/dashboard/app/Badge.js'
import {CompactRecordFields} from '#/dashboard/app/CompactField.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {
  ExternalLinkPicker,
  type ExternalLinkValue
} from '#/dashboard/app/ExternalLinkPicker.js'
import {ImagePicker} from '#/dashboard/app/ImagePicker.js'
import {LinkPicker} from '#/dashboard/app/LinkPicker.js'
import {nav} from '#/dashboard/DashboardNav.js'
import {
  useDashboard,
  useEntry,
  useField,
  useFieldNode,
  useFieldOptions,
  useGraph,
  useNodes
} from '#/dashboard/hooks.js'
import {
  IcRoundAttachFile,
  IcRoundClose,
  IcRoundEdit,
  IcRoundLink,
  IcRoundMoreHoriz,
  IcRoundOpenInNew,
  IcRoundPanorama
} from '#/dashboard/icons.js'
import {
  type DashboardEntry,
  type DashboardEntryData,
  type ExplorerOptions,
  ReactiveNode
} from '#/dashboard/store.js'
import {type LinkRow as LinkFieldRow} from '#/field/link.js'
import {LinkField, LinksField} from '#/field/link/LinkField.js'
import type {
  EditorInfo,
  EditorLocation,
  EntryPickerOptions
} from '#/picker/entry.js'
import styler from '@alinea/styler'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import type {ComponentPropsWithoutRef, ComponentType, ReactNode} from 'react'
import {Fragment, useEffect, useMemo, useRef, useState} from 'react'
import {
  type DragItem,
  DragPreview,
  type DragPreviewRenderer,
  type DropItem,
  useDrag,
  useDrop
} from 'react-aria'
import css from './LinkField.module.css'

const styles = styler(css)

type PickerType = 'entry' | 'url' | 'file' | 'image'
type EntryPickerType = Exclude<PickerType, 'url'>
const LINK_FIELD_ROW_DRAG_TYPE = 'application/x-alinea-link-field-row'

interface LinkRowProps {
  hasFields?: boolean
  node: ReactiveNode<LinkFieldRow>
}

function LinkRow({hasFields, node}: LinkRowProps) {
  const type = useAtomValue(node.field('_type')) as string | undefined
  return (
    <>
      {type && type !== 'image' && (
        <Icon
          aria-hidden
          className={styles.LinkFieldView.icon()}
          icon={getLinkIcon(type)}
        />
      )}
      {(type === 'entry' || type === 'image' || type === 'file') && (
        <EntryRowLayer hasFields={hasFields} node={node} />
      )}
      {type === 'url' && <UrlRow node={node} />}
    </>
  )
}

function LinkRowText({node}: LinkRowProps) {
  const type = useAtomValue(node.field('_type')) as string | undefined
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
  const entryId = useAtomValue(node.field('_entry')) as string | undefined
  const type = useAtomValue(node.field('_type')) as string | undefined
  if (!entryId) return null
  return (
    <EntryRow
      entryId={entryId}
      hasFields={hasFields}
      image={type === 'image'}
      textOnly={textOnly}
    />
  )
}

interface EntryRowProps {
  entryId: string
  hasFields?: boolean
  image?: boolean
  textOnly?: boolean
}

function EntryRow({entryId, hasFields, image, textOnly}: EntryRowProps) {
  const dashboard = useDashboard()
  const entry = dashboard.entries(entryId)
  const {pending, data, error} = useAtomValue(entry.data)
  if (data)
    return (
      <LoadedEntryRow
        entry={data}
        hasFields={hasFields}
        image={image}
        textOnly={textOnly}
      />
    )
  if (error)
    return (
      <MissingEntryRow
        entryId={entryId}
        hasFields={hasFields}
        image={image}
        textOnly={textOnly}
      />
    )
  if (!pending)
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
      pending
      textOnly={textOnly}
    />
  )
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
  entry: DashboardEntryData
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
  const label = useAtomValue(entry.label)
  const parentIds = useAtomValue(entry.parentIds)
  const [parentsPending, parents] = useAtomValue(entry.parentsState)
  return (
    <span className={styles.LinkFieldView.label()}>
      {image && !textOnly && (
        <EntryRowImage entry={entry} hasFields={hasFields} />
      )}
      <span className={styles.LinkFieldView.labelText()}>
        <span className={styles.LinkFieldView.title()}>{label}</span>
        {(parentsPending && parents === undefined && parentIds.length > 0) ||
        (parents && parents.length > 0) ? (
          <span className={styles.LinkFieldView.meta()}>
            <EntryParents
              loading={parentsPending && parents === undefined}
              parents={parents ?? []}
            />
          </span>
        ) : null}
      </span>
    </span>
  )
}

interface EntryRowImageProps {
  entry: DashboardEntryData
  hasFields?: boolean
}

function EntryRowImage({entry, hasFields}: EntryRowImageProps) {
  const {pending, data: fileInfo} = useAtomValue(entry.fileInfoState)
  if (fileInfo?.preview) {
    return (
      <img
        alt=""
        className={styles.LinkFieldView.image()}
        data-has-fields={hasFields ? 'true' : undefined}
        src={fileInfo.preview}
      />
    )
  }
  if (pending) {
    return (
      <span
        className={styles.LinkFieldView.imagePlaceholder()}
        data-has-fields={hasFields ? 'true' : undefined}
        aria-hidden="true"
      />
    )
  }
  return null
}

function UrlRow({node, textOnly}: RowLayerProps) {
  const title = useAtomValue(node.field('_title')) as string | undefined
  const url = useAtomValue(node.field('_url')) as string | undefined
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
  loading: boolean
  parents: Array<DashboardEntry>
}

function EntryParents({loading, parents}: EntryParentsProps) {
  if (loading) return <EntryParentsLoading />
  return (
    <>
      {parents.map((parent, index) => (
        <EntryParentLabel
          key={parent.id}
          parent={parent}
          suffix={index < parents.length - 1 ? ' / ' : ''}
        />
      ))}
    </>
  )
}

function EntryParentsLoading() {
  return (
    <>
      <span
        className={styles.LinkFieldView.skeleton({wide: true})}
        aria-hidden="true"
      />
      {' / '}
      <span className={styles.LinkFieldView.skeleton()} aria-hidden="true" />
    </>
  )
}

interface EntryParentLabelProps {
  parent: DashboardEntry
  suffix: string
}

function EntryParentLabel({parent, suffix}: EntryParentLabelProps) {
  const {data} = useAtomValue(parent.data)
  if (!data) return null
  return <LoadedEntryParentLabel parent={data} suffix={suffix} />
}

interface LoadedEntryParentLabelProps {
  parent: DashboardEntryData
  suffix: string
}

function LoadedEntryParentLabel({parent, suffix}: LoadedEntryParentLabelProps) {
  const label = useAtomValue(parent.label)
  return (
    <>
      {label}
      {suffix}
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
  ariaLabel?: string
  buttonAppearance?: 'solid' | 'outline' | 'plain' | 'active'
  buttonIcon?: ComponentType
  buttonSize?: 'small' | 'icon' | 'icon-small'
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
  picker: Picker<LinkFieldRow>
) {
  return {
    ...initialFields(picker),
    _id: createId(),
    _type: getEntryPickerType(type),
    _index: '',
    _entry: entryId
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

function initialFields(picker: Picker<LinkFieldRow>) {
  if (!picker.fields) return {}
  return Type.initialValue(picker.fields) as Record<string, unknown>
}

function LinkPickerAction({
  ariaLabel,
  buttonAppearance = 'plain',
  buttonIcon,
  buttonSize,
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
  const dashboard = useDashboard()
  const selectedWorkspace = useAtomValue(dashboard.selectedWorkspace)
  const selectedRoot = useAtomValue(dashboard.selectedRoot)
  const selectedMediaRoot = useAtomValue(dashboard.selectedMediaRoot)
  const options = picker.options as Partial<EntryPickerOptions>
  const condition =
    typeof options.condition === 'function' ? undefined : options.condition
  const fallbackRoot =
    type === 'file' || type === 'image' ? selectedMediaRoot : selectedRoot
  const fallbackLocation: EditorLocation | undefined =
    selectedWorkspace && fallbackRoot
      ? {workspace: selectedWorkspace, root: fallbackRoot}
      : undefined
  const location = useResolvedEntryPickerLocation(options, fallbackLocation)

  if (type === 'url') {
    return (
      <DialogTrigger>
        <Button
          aria-label={ariaLabel}
          appearance={buttonAppearance}
          className={className}
          icon={buttonIcon}
          isDisabled={isDisabled}
          size={buttonSize}
        >
          {children}
        </Button>
        <ExternalLinkPicker
          initialValue={externalLinkValue(value)}
          selectionMode="single"
          submitLabel={value ? 'Save link' : undefined}
          onConfirm={link => onPick(createUrlLink(link, picker, value))}
        />
      </DialogTrigger>
    )
  }
  const handlesMultiple = Boolean(onPickMany && picker.handlesMultiple)
  const pickerProps: ExplorerOptions = {
    condition,
    location,
    selectionMode: handlesMultiple ? 'multiple' : 'single',
    selectionBehavior: handlesMultiple ? 'toggle' : 'replace',
    initialSelection: initialSelection(value, selection),
    onConfirm(selection: Array<string>) {
      const links = selection.map(entryId =>
        createEntryLink(type, entryId, picker)
      )
      if (onPickMany) return onPickMany(links)
      const [link] = links
      if (link) onPick(link)
    }
  } as const
  if (type === 'file' || type === 'image') {
    return (
      <DialogTrigger>
        <Button
          aria-label={ariaLabel}
          appearance={buttonAppearance}
          className={className}
          icon={buttonIcon}
          isDisabled={isDisabled}
          size={buttonSize}
        >
          {children}
        </Button>
        <ImagePicker
          {...pickerProps}
          key={`${location?.workspace}:${location?.root}:${location?.parentId}`}
          label={type === 'file' ? 'Pick a file' : 'Pick an image'}
        />
      </DialogTrigger>
    )
  }
  return (
    <DialogTrigger>
      <Button
        aria-label={ariaLabel}
        appearance={buttonAppearance}
        className={className}
        icon={buttonIcon}
        isDisabled={isDisabled}
        size={buttonSize}
      >
        {children}
      </Button>
      <LinkPicker
        {...pickerProps}
        key={`${location?.workspace}:${location?.root}:${location?.parentId}`}
      />
    </DialogTrigger>
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
  const dashboard = useDashboard()
  const selectedWorkspace = useAtomValue(dashboard.selectedWorkspace)
  const selectedRoot = useAtomValue(dashboard.selectedRoot)
  const selectedMediaRoot = useAtomValue(dashboard.selectedMediaRoot)

  function handlePick(link: LinkFieldRow) {
    onPick(link)
    onOpenChange(false)
  }

  const options = picker.options as Partial<EntryPickerOptions>
  const condition =
    typeof options.condition === 'function' ? undefined : options.condition
  const fallbackRoot =
    type === 'file' || type === 'image' ? selectedMediaRoot : selectedRoot
  const fallbackLocation: EditorLocation | undefined =
    selectedWorkspace && fallbackRoot
      ? {workspace: selectedWorkspace, root: fallbackRoot}
      : undefined
  const location = useResolvedEntryPickerLocation(options, fallbackLocation)

  if (type === 'url') {
    return (
      <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
        <Button style={{display: 'none'}}>Edit link</Button>
        <ExternalLinkPicker
          initialValue={externalLinkValue(value)}
          selectionMode="single"
          submitLabel={value ? 'Save link' : undefined}
          onConfirm={link => handlePick(createUrlLink(link, picker, value))}
        />
      </DialogTrigger>
    )
  }
  const handlesMultiple = Boolean(onPickMany && picker.handlesMultiple)
  const pickerProps: ExplorerOptions = {
    condition,
    location,
    selectionMode: handlesMultiple ? 'multiple' : 'single',
    selectionBehavior: handlesMultiple ? 'toggle' : 'replace',
    initialSelection: initialSelection(value, selection),
    onConfirm(selection: Array<string>) {
      const links = selection.map(entryId =>
        createEntryLink(type, entryId, picker)
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
      <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
        <Button style={{display: 'none'}}>Edit link</Button>
        <ImagePicker
          {...pickerProps}
          key={`${location?.workspace}:${location?.root}:${location?.parentId}`}
          label={type === 'file' ? 'Pick a file' : 'Pick an image'}
        />
      </DialogTrigger>
    )
  }
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button style={{display: 'none'}}>Edit link</Button>
      <LinkPicker
        {...pickerProps}
        key={`${location?.workspace}:${location?.root}:${location?.parentId}`}
      />
    </DialogTrigger>
  )
}

function useResolvedEntryPickerLocation(
  options: Partial<EntryPickerOptions>,
  fallbackLocation: EditorLocation | undefined
): EditorLocation | undefined {
  const graph = useGraph()
  const entry = useEntry()
  const [location, setLocation] = useState(() =>
    typeof options.location === 'function'
      ? fallbackLocation
      : (options.location ?? fallbackLocation)
  )

  useEffect(() => {
    if (typeof options.location !== 'function') {
      setLocation(options.location ?? fallbackLocation)
      return
    }

    if (!entry) {
      setLocation(fallbackLocation)
      return
    }

    let cancelled = false
    const info: EditorInfo = {graph, entry}
    Promise.resolve(options.location(info))
      .then(location => {
        if (!cancelled) setLocation(location ?? fallbackLocation)
      })
      .catch(error => {
        console.error('Failed to resolve entry picker location', error)
        if (!cancelled) setLocation(fallbackLocation)
      })

    return () => {
      cancelled = true
    }
  }, [
    entry?.id,
    entry?.locale,
    entry?.parentId,
    entry?.root,
    entry?.type,
    entry?.workspace,
    fallbackLocation?.parentId,
    fallbackLocation?.root,
    fallbackLocation?.workspace,
    graph,
    options.location
  ])

  return location
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

function insertIndex(rowIndex: number, position: 'before' | 'after'): number {
  return position === 'before' ? rowIndex : rowIndex + 1
}

function reorderIndex(fromIndex: number, targetIndex: number): number {
  return fromIndex < targetIndex ? targetIndex - 1 : targetIndex
}

function dragRowItem(id: string): DragItem {
  return {
    'text/plain': id,
    [LINK_FIELD_ROW_DRAG_TYPE]: id
  }
}

function rowDropPosition(
  row: HTMLDivElement | null,
  y: number
): 'before' | 'after' {
  if (!row) return 'after'
  return y < row.offsetHeight / 2 ? 'before' : 'after'
}

async function getDraggedRowId(
  items: Array<DropItem>,
  dragType: string
): Promise<string | null> {
  for (const item of items) {
    if (item.kind === 'text' && item.types.has(dragType) && item.getText) {
      return item.getText(dragType)
    }
  }
  return null
}

interface SingleLinkCreateActionsProps extends StandardFieldActionProps {
  value?: LinkFieldRow
}

function SingleLinkCreateActions({field, value}: SingleLinkCreateActionsProps) {
  const options = useFieldOptions(field)
  const [, setValue] = useField(field)
  if (options.readOnly) return null
  return (
    <div className={styles.LinkFieldView.create()}>
      {Object.entries(options.pickers).map(([type, picker]) => (
        <LinkPickerAction
          buttonSize="small"
          className={styles.LinkFieldView.createButton()}
          key={type}
          onPick={setValue}
          picker={picker as Picker<LinkFieldRow>}
          type={type as PickerType}
          value={value?._type === type ? value : undefined}
        >
          <Icon aria-hidden icon={getLinkIcon(type)} />
          {picker.label}
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
  const links = value ?? []
  const showCreate = options.max ? links.length < options.max : true
  if (options.readOnly) return null
  if (!showCreate) return null
  return (
    <div className={styles.LinkFieldView.create()}>
      {Object.entries(options.pickers).map(([type, picker]) => (
        <LinkPickerAction
          buttonSize="small"
          className={styles.LinkFieldView.createButton()}
          key={type}
          onPick={link => {
            setValue(links => [...(links ?? []), link])
          }}
          onPickMany={picked => {
            if (picker.handlesMultiple) {
              setValue(links => [
                ...(links ?? []).filter(link => link._type !== type),
                ...picked
              ])
            } else {
              setValue(links => [...(links ?? []), ...picked])
            }
          }}
          picker={picker as Picker<LinkFieldRow>}
          selection={links.filter(row => row._type === type)}
          type={type as PickerType}
        >
          <Icon aria-hidden icon={getLinkIcon(type)} />
          {picker.label}
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
  onRemove: () => void
}

function LinkRowActions({
  closeActions,
  isDisabled,
  picker,
  type,
  value,
  onEdit,
  onRemove
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
          aria-label="Edit link"
          appearance="plain"
          icon={IcRoundEdit}
          isDisabled={isDisabled}
          onPress={() => {
            closeActions()
            onEdit()
          }}
        >
          Edit link
        </Button>
      )}
      <Button
        aria-label="Remove link"
        appearance="plain"
        icon={IcRoundClose}
        isDisabled={isDisabled}
        onPress={() => {
          onRemove()
          closeActions()
        }}
      >
        Remove link
      </Button>
    </>
  )
}

interface LinkLabelFieldProps {
  isDisabled?: boolean
  node: ReactiveNode<LinkFieldRow>
  value: LinkFieldRow
}

function LinkLabelField({isDisabled, node, value}: LinkLabelFieldProps) {
  const customLabel = useAtomValue(node.field('_label')) as string | undefined
  const setCustomLabel = useSetAtom(node.field('_label'))
  if ('_entry' in value) {
    return (
      <EntryLinkLabelField
        customLabel={customLabel}
        entryId={value._entry}
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
  const suffix = useAtomValue(node.field('_suffix')) as string | undefined
  const setSuffix = useSetAtom(node.field('_suffix'))
  if (value[Reference.type] !== 'entry') return null
  return (
    <TextField
      description="For example: #id"
      isDisabled={isDisabled}
      label="URL suffix"
      onChange={next => setSuffix(next || undefined)}
      value={suffix ?? ''}
    />
  )
}

interface LinkMetaLabelProps {
  className: string
  node: ReactiveNode<LinkFieldRow>
  value: LinkFieldRow
}

function LinkMetaLabel({className, node, value}: LinkMetaLabelProps) {
  const customLabel = useAtomValue(node.field('_label')) as string | undefined
  if ('_entry' in value) {
    return (
      <EntryLinkMetaLabel
        className={className}
        customLabel={customLabel}
        entryId={value._entry}
      />
    )
  }
  return (
    <ResolvedLinkMetaLabel
      className={className}
      label={customLabel || linkFallbackLabel(value)}
    />
  )
}

function linkFallbackLabel(value: LinkFieldRow): string | undefined {
  if ('_title' in value && value._title) return value._title
  if ('_url' in value && value._url) return value._url
  return undefined
}

interface EntryLinkMetaLabelProps {
  className: string
  customLabel?: string
  entryId: string
}

function EntryLinkMetaLabel({
  className,
  customLabel,
  entryId
}: EntryLinkMetaLabelProps) {
  const dashboard = useDashboard()
  const {data} = useAtomValue(dashboard.entries(entryId).data)
  if (!data) {
    return <ResolvedLinkMetaLabel className={className} label={customLabel} />
  }
  return (
    <LoadedEntryLinkMetaLabel
      className={className}
      customLabel={customLabel}
      data={data}
    />
  )
}

interface LoadedEntryLinkMetaLabelProps {
  className: string
  customLabel?: string
  data: DashboardEntryData
}

function LoadedEntryLinkMetaLabel({
  className,
  customLabel,
  data
}: LoadedEntryLinkMetaLabelProps) {
  const fallbackLabel = useAtomValue(data.label)
  return (
    <ResolvedLinkMetaLabel
      className={className}
      label={customLabel ?? fallbackLabel}
    />
  )
}

interface ResolvedLinkMetaLabelProps {
  className: string
  label?: string
}

function ResolvedLinkMetaLabel({className, label}: ResolvedLinkMetaLabelProps) {
  const value = label?.trim()
  if (!value) return null
  return <span className={className}>{value}</span>
}

interface LinkTypeBadgeProps extends ComponentPropsWithoutRef<'span'> {
  picker?: Picker<LinkFieldRow>
  type: PickerType
  value: LinkFieldRow
}

function LinkTypeBadge({picker, type, value, ...props}: LinkTypeBadgeProps) {
  const fallbackIcon = getLinkIcon(type)
  const fallbackLabel = picker?.label ?? type
  if (type === 'image') return null
  if (type === 'file') {
    return (
      <Badge {...props} icon={IcRoundAttachFile} size="small">
        File
      </Badge>
    )
  }
  if ('_entry' in value) {
    return (
      <EntryLinkTypeBadge
        {...props}
        entryId={value._entry}
        fallbackIcon={fallbackIcon}
        fallbackLabel={fallbackLabel}
      />
    )
  }
  return (
    <Badge {...props} icon={fallbackIcon} size="small">
      {fallbackLabel}
    </Badge>
  )
}

interface EntryLinkImagePreviewProps {
  entryId: string
}

function EntryLinkImagePreview({entryId}: EntryLinkImagePreviewProps) {
  const dashboard = useDashboard()
  const {data} = useAtomValue(dashboard.entries(entryId).data)
  if (!data)
    return <span className={styles.LinkFieldView.previewImagePlaceholder()} />
  return <LoadedEntryLinkImagePreview entry={data} />
}

interface LoadedEntryLinkImagePreviewProps {
  entry: DashboardEntryData
}

function LoadedEntryLinkImagePreview({
  entry
}: LoadedEntryLinkImagePreviewProps) {
  const {pending, data: fileInfo} = useAtomValue(entry.fileInfoState)
  if (fileInfo?.preview) {
    return (
      <img
        alt=""
        className={styles.LinkFieldView.previewImage()}
        src={fileInfo.preview}
      />
    )
  }
  if (pending)
    return <span className={styles.LinkFieldView.previewImagePlaceholder()} />
  return null
}

interface EntryLinkTypeBadgeProps extends ComponentPropsWithoutRef<'span'> {
  entryId: string
  fallbackIcon: ComponentType
  fallbackLabel: string
}

function EntryLinkTypeBadge({
  entryId,
  fallbackIcon,
  fallbackLabel,
  ...props
}: EntryLinkTypeBadgeProps) {
  const dashboard = useDashboard()
  const {data} = useAtomValue(dashboard.entries(entryId).data)
  if (!data) {
    return (
      <Badge {...props} icon={fallbackIcon} size="small">
        {fallbackLabel}
      </Badge>
    )
  }
  return <LoadedEntryTypeBadge {...props} entry={data} />
}

interface LoadedEntryTypeBadgeProps extends ComponentPropsWithoutRef<'span'> {
  entry: DashboardEntryData
}

function LoadedEntryTypeBadge({
  className,
  entry,
  ...props
}: LoadedEntryTypeBadgeProps) {
  const type = useAtomValue(entry.type)
  return (
    <Badge
      {...props}
      className={styles.LinkFieldView.type(styler.merge({className}))}
      icon={type.icon || IcRoundLink}
      size="small"
    >
      {type.label}
    </Badge>
  )
}

interface EntryLinkLabelFieldProps {
  customLabel?: string
  entryId: string
  isDisabled?: boolean
  onChange: (value: string | undefined) => void
}

function EntryLinkLabelField({
  customLabel,
  entryId,
  isDisabled,
  onChange
}: EntryLinkLabelFieldProps) {
  const dashboard = useDashboard()
  const {data} = useAtomValue(dashboard.entries(entryId).data)
  if (data) {
    return (
      <LoadedEntryLinkLabelField
        customLabel={customLabel}
        data={data}
        isDisabled={isDisabled}
        onChange={onChange}
      />
    )
  }
  return (
    <ResolvedLinkLabelField
      customLabel={customLabel}
      isDisabled={isDisabled}
      onChange={onChange}
    />
  )
}

interface LoadedEntryLinkLabelFieldProps {
  customLabel?: string
  data: DashboardEntryData
  isDisabled?: boolean
  onChange: (value: string | undefined) => void
}

function LoadedEntryLinkLabelField({
  customLabel,
  data,
  isDisabled,
  onChange
}: LoadedEntryLinkLabelFieldProps) {
  const fallbackLabel = useAtomValue(data.label)
  return (
    <ResolvedLinkLabelField
      customLabel={customLabel}
      fallbackLabel={fallbackLabel}
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
      autoFocus
      isDisabled={isDisabled}
      label="Label"
      onChange={onChange}
      value={customLabel ?? fallbackLabel}
    />
  )
}

function LinkSettingsButton() {
  return (
    <ListRowSettingsButton aria-label="Link settings" icon={IcRoundMoreHoriz} />
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
  if (!('_entry' in value)) return null
  return (
    <EntryLinkRowActions
      closeActions={closeActions}
      entryId={value._entry}
      type={type}
    />
  )
}

interface EntryLinkRowActionsProps {
  closeActions: () => void
  entryId: string
  type: PickerType
}

function EntryLinkRowActions({
  closeActions,
  entryId,
  type
}: EntryLinkRowActionsProps) {
  const dashboard = useDashboard()
  const route = useAtomValue(dashboard.route)
  const {data} = useAtomValue(dashboard.entries(entryId).data)
  if (!data) {
    return (
      <Button
        aria-label="Open link"
        appearance="plain"
        icon={IcRoundOpenInNew}
        isDisabled
        size="small"
      >
        Open link
      </Button>
    )
  }
  return (
    <LoadedEntryLinkRowActions
      closeActions={closeActions}
      entry={data}
      locale={type === 'entry' ? route.locale : undefined}
    />
  )
}

interface LoadedEntryLinkRowActionsProps {
  closeActions: () => void
  entry: DashboardEntryData
  locale?: string
}

function LoadedEntryLinkRowActions({
  closeActions,
  entry,
  locale
}: LoadedEntryLinkRowActionsProps) {
  const workspace = useAtomValue(entry.workspaceKey)
  const root = useAtomValue(entry.rootKey)
  const href = `#${nav.entry(workspace, root, entry.entry.id, locale)}`
  return (
    <Button
      aria-label="Open link"
      appearance="plain"
      icon={IcRoundOpenInNew}
      onPress={() => {
        window.open(href, '_blank', 'noopener,noreferrer')
        closeActions()
      }}
    >
      Open link
    </Button>
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
  const [actionsOpen, setActionsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  function closeActions() {
    setActionsOpen(false)
  }

  return (
    <>
      <ListRow aria-label="Link item 1" first role="listitem">
        <ListRowHeader first hasFold={false}>
          {imagePreviewEntryId && (
            <EntryLinkImagePreview entryId={imagePreviewEntryId} />
          )}
          <ListRowDrag>
            <ListRowBadges>
              <LinkTypeBadge
                className={styles.LinkFieldView.type()}
                picker={picker}
                type={type}
                value={value}
              />
              <LinkMetaLabel
                className={styles.LinkFieldView.metaLabel()}
                node={node}
                value={value}
              />
            </ListRowBadges>
          </ListRowDrag>
          {!options.readOnly && (
            <ListRowActions>
              <DialogTrigger isOpen={actionsOpen} onOpenChange={setActionsOpen}>
                <LinkSettingsButton />
                <Popover placement="bottom right">
                  <ListRowSettings>
                    <LinkLabelField node={node} value={value} />
                    <EntryLinkSuffixField node={node} value={value} />
                  </ListRowSettings>
                  <MenuSeparator />
                  <ListRowSettings actions>
                    <LinkRowActions
                      closeActions={closeActions}
                      onEdit={() => setEditOpen(true)}
                      onRemove={() => setValue(undefined!)}
                      picker={picker}
                      type={type}
                      value={value}
                    />
                  </ListRowSettings>
                </Popover>
              </DialogTrigger>
            </ListRowActions>
          )}
        </ListRowHeader>
        {hasFields && (
          <ListRowBody>
            <LinkRowEditor node={node} picker={picker} />
          </ListRowBody>
        )}
      </ListRow>
      {picker && (
        <LinkPickerDialog
          isOpen={editOpen}
          onOpenChange={setEditOpen}
          onPick={setValue}
          picker={picker}
          type={type}
          value={value}
        />
      )}
    </>
  )
}

interface MultipleLinkRowProps {
  dragging: boolean
  expanded: boolean
  field: LinksField<LinkFieldRow, unknown>
  index: number
  node: ReactiveNode<LinkFieldRow>
  onMoveRow: (rowId: string, targetIndex: number) => void
  onRowDragEnd: () => void
  onRowDragStart: () => void
  onDropIndicatorChange: (position: 'before' | 'after' | null) => void
  onToggleRow: (rowId: string) => void
  value: LinkFieldRow
}

interface LinkFieldDropIndicatorState {
  index: number
  position: 'before' | 'after'
}

interface LinkFieldDragPreviewProps {
  icon: ComponentType
  label: ReactNode
}

function LinkFieldDragPreview({icon, label}: LinkFieldDragPreviewProps) {
  return <ListDragPreview icon={icon} label={label} />
}

function MultipleLinkRow({
  dragging,
  expanded,
  field,
  index,
  node,
  onMoveRow,
  onRowDragEnd,
  onRowDragStart,
  onDropIndicatorChange,
  onToggleRow,
  value
}: MultipleLinkRowProps) {
  const [linksValue, setValue] = useField(field)
  const options = useFieldOptions(field)
  const links = linksValue ?? []
  const type = getPickerType(value[Reference.type])
  const picker = options.pickers[type] as Picker<LinkFieldRow> | undefined
  const hasFields = Boolean(picker?.fields)
  const imagePreviewEntryId =
    type === 'image' && '_entry' in value ? value._entry : undefined
  const itemId = value[Reference.id]
  const readOnly = Boolean(options.readOnly)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const dragPreview = useRef<DragPreviewRenderer | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const {dragProps, isDragging} = useDrag({
    getItems() {
      return [dragRowItem(itemId)]
    },
    getAllowedDropOperations() {
      return ['move']
    },
    isDisabled: readOnly,
    onDragEnd: onRowDragEnd,
    onDragStart: onRowDragStart,
    preview: dragPreview
  })
  const {dropProps, isDropTarget} = useDrop({
    ref: rowRef,
    isDisabled: readOnly || !dragging,
    getDropOperation(types, allowedOperations) {
      if (!types.has(LINK_FIELD_ROW_DRAG_TYPE)) return 'cancel'
      return allowedOperations.includes('move') ? 'move' : 'cancel'
    },
    getDropOperationForPoint(types, allowedOperations) {
      if (!types.has(LINK_FIELD_ROW_DRAG_TYPE)) return 'cancel'
      return allowedOperations.includes('move') ? 'move' : 'cancel'
    },
    onDropEnter(event) {
      const position = rowDropPosition(rowRef.current, event.y)
      onDropIndicatorChange(position)
    },
    onDropMove(event) {
      const position = rowDropPosition(rowRef.current, event.y)
      onDropIndicatorChange(position)
    },
    onDropExit() {
      onDropIndicatorChange(null)
    },
    async onDrop(event) {
      const position = rowDropPosition(rowRef.current, event.y)
      const rowId = await getDraggedRowId(event.items, LINK_FIELD_ROW_DRAG_TYPE)
      onDropIndicatorChange(null)
      if (!rowId) return
      onMoveRow(rowId, insertIndex(index, position))
    }
  })

  function closeActions() {
    setActionsOpen(false)
  }

  return (
    <>
      <div
        {...dropProps}
        className={styles.LinkFieldView.rowDropTarget()}
        ref={rowRef}
      >
        <ListRow
          aria-label={`Link item ${index + 1}`}
          dragging={isDragging}
          first={index === 0}
          role="listitem"
        >
          <ListRowHeader first={index === 0} hasFold={hasFields}>
            {!readOnly && (
              <ListRowDragHandle
                {...dragProps}
                aria-label={`Drag link item ${index + 1}`}
                dragging={isDragging}
              />
            )}
            {imagePreviewEntryId && !hasFields && (
              <EntryLinkImagePreview entryId={imagePreviewEntryId} />
            )}
            <DragPreview ref={dragPreview}>
              {() => (
                <LinkFieldDragPreview
                  icon={getLinkIcon(type)}
                  label={<LinkRowText node={node} />}
                />
              )}
            </DragPreview>
            <ListRowDrag dragging={isDragging}>
              <ListRowBadges>
                {hasFields && (
                  <ListRowFoldButton
                    aria-label={expanded ? 'Collapse link' : 'Expand link'}
                    expanded={expanded}
                    onPress={() => onToggleRow(itemId)}
                  />
                )}
                {imagePreviewEntryId && hasFields && (
                  <EntryLinkImagePreview entryId={imagePreviewEntryId} />
                )}
                <LinkTypeBadge picker={picker} type={type} value={value} />
                <LinkMetaLabel
                  className={styles.LinkFieldView.metaLabel()}
                  node={node}
                  value={value}
                />
              </ListRowBadges>
            </ListRowDrag>
            <ListRowActions>
              <DialogTrigger isOpen={actionsOpen} onOpenChange={setActionsOpen}>
                <LinkSettingsButton />
                <Popover placement="bottom right">
                  <ListRowSettings>
                    <LinkLabelField
                      isDisabled={readOnly}
                      node={node}
                      value={value}
                    />
                    <EntryLinkSuffixField
                      isDisabled={readOnly}
                      node={node}
                      value={value}
                    />
                  </ListRowSettings>
                  <MenuSeparator />
                  <ListRowSettings actions>
                    <LinkRowActions
                      closeActions={closeActions}
                      isDisabled={readOnly}
                      onEdit={() => setEditOpen(true)}
                      onRemove={() =>
                        setValue(links =>
                          links.filter(
                            (_, currentIndex) => currentIndex !== index
                          )
                        )
                      }
                      picker={picker}
                      type={type}
                      value={value}
                    />
                  </ListRowSettings>
                </Popover>
              </DialogTrigger>
            </ListRowActions>
          </ListRowHeader>
          {expanded && hasFields && (
            <ListRowBody>
              <LinkRowEditor node={node} picker={picker} />
            </ListRowBody>
          )}
          {!expanded && picker?.fields && (
            <ListRowFooter>
              <CompactRecordFields
                fields={Type.fields(picker.fields)}
                layout="footer"
                value={value}
              />
            </ListRowFooter>
          )}
        </ListRow>
      </div>
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

interface LinkFieldDropIndicatorProps {
  active: boolean
}

function LinkFieldDropIndicator({active}: LinkFieldDropIndicatorProps) {
  return (
    <div
      aria-hidden
      className={styles.LinkFieldView.dropIndicator()}
      data-active={active || undefined}
    />
  )
}

export interface SingleLinkFieldViewProps {
  field: LinkField<LinkFieldRow, unknown>
}

export function SingleLinkFieldView({field}: SingleLinkFieldViewProps) {
  const [value] = useField(field)
  const options = useFieldOptions(field)
  const node = useFieldNode(field)
  const nodeIsEmpty = useAtomValue(node.isEmpty)
  const selectedValue = isLinkFieldRow(value) ? value : undefined
  const isEmpty = nodeIsEmpty || !selectedValue
  const hasRows = Boolean(selectedValue)
  const readOnly = Boolean(options.readOnly)
  const selectedPicker = selectedValue
    ? (options.pickers[getPickerType(selectedValue[Reference.type])] as
        | Picker<LinkFieldRow>
        | undefined)
    : undefined
  const showFold = Boolean(selectedPicker?.fields)
  const content = (hasRows || !readOnly) && (
    <List aria-label={options.label || 'Link'} data-depth="muted">
      {selectedValue && (
        <SingleLinkRow
          field={field}
          node={node as ReactiveNode<LinkFieldRow>}
          value={selectedValue}
        />
      )}
      {isEmpty && !readOnly && (
        <ListCreateRow empty>
          <SingleLinkCreateActions field={field} />
        </ListCreateRow>
      )}
    </List>
  )
  return (
    <>
      <ListLabel
        aria-label={hasRows ? 'Link selected' : 'No link selected'}
        expanded
        hasRows={hasRows}
        isDisabled
        description={options.help}
        shared={options.shared}
        showFold={showFold}
        inline={options.inline}
      >
        {options.label}
      </ListLabel>
      {content}
    </>
  )
}

export interface MultipleLinksFieldViewProps {
  field: LinksField<LinkFieldRow, unknown>
}

export function MultipleLinksFieldView({field}: MultipleLinksFieldViewProps) {
  const [value] = useField(field)
  const options = useFieldOptions(field)
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
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] =
    useState<LinkFieldDropIndicatorState | null>(null)
  const rowIdsAtom = useMemo(
    () =>
      atom(get => {
        const nodes = get(list.nodes) as Array<ReactiveNode<LinkFieldRow>>
        return nodes.map(node => get(node.field('_id')) as string)
      }),
    [list]
  )
  const rowIds = useAtomValue(rowIdsAtom)
  const moveRowAtom = useMemo(
    () =>
      atom(null, (get, set, rowId: string, targetIndex: number) => {
        const currentNodes = get(list.nodes) as Array<
          ReactiveNode<LinkFieldRow>
        >
        const fromIndex = currentNodes.findIndex(node => {
          return get(node.field('_id')) === rowId
        })
        if (fromIndex === -1) return
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

  function isBoundaryDropTarget(index: number) {
    return (
      (dropIndicator?.index === index && dropIndicator.position === 'before') ||
      (dropIndicator?.index === index - 1 && dropIndicator.position === 'after')
    )
  }

  const content = (hasRows || !readOnly) && (
    <>
      <LinkFieldDropIndicator
        active={
          dropIndicator?.index === 0 && dropIndicator.position === 'before'
        }
      />
      <List aria-label={options.label || 'Links'} data-depth="muted">
        {nodes.length > 0 && (
          <>
            {nodes.map((node, index) => {
              const value = links[index]
              if (!value) return null
              return (
                <Fragment key={value._id}>
                  {index > 0 && (
                    <LinkFieldDropIndicator
                      active={isBoundaryDropTarget(index)}
                    />
                  )}
                  <MultipleLinkRow
                    dragging={Boolean(draggingRowId)}
                    expanded={!foldedIds.has(value._id)}
                    field={field}
                    index={index}
                    node={node}
                    onMoveRow={moveRow}
                    onRowDragEnd={() => {
                      setDraggingRowId(null)
                      setDropIndicator(null)
                    }}
                    onRowDragStart={() => setDraggingRowId(value._id)}
                    onDropIndicatorChange={position =>
                      setDropIndicator(position ? {index, position} : null)
                    }
                    onToggleRow={toggleRow}
                    value={value}
                  />
                </Fragment>
              )
            })}
          </>
        )}
        <LinkFieldDropIndicator
          active={
            dropIndicator?.index === nodes.length - 1 &&
            dropIndicator.position === 'after'
          }
        />
        {!readOnly && (
          <ListCreateRow empty={!hasRows}>
            <MultipleLinkCreateActions field={field} />
          </ListCreateRow>
        )}
      </List>
    </>
  )

  return (
    <>
      <ListLabel
        aria-label={
          hasRows
            ? allExpanded
              ? 'Collapse all links'
              : 'Expand all links'
            : 'No links to fold'
        }
        expanded={allExpanded}
        hasRows={hasRows}
        isDisabled={!hasFoldableRows}
        onPress={toggleAll}
        description={options.help}
        shared={options.shared}
        showFold={hasFoldableRows}
        inline={options.inline}
      >
        {options.label}
      </ListLabel>
      {content}
    </>
  )
}
