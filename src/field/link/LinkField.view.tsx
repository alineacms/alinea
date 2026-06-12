import {
  Button,
  DialogTrigger,
  FoldIcon,
  Icon,
  Label,
  SharedLabelBadge
} from '#/components.js'
import {createId} from '#/core/Id.js'
import type {Picker} from '#/core/Picker.js'
import {Reference} from '#/core/Reference.js'
import {Type} from '#/core/Type.js'
import {CompactRecordFields} from '#/dashboard/app/CompactField.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {
  ExternalLinkPicker,
  type ExternalLinkValue
} from '#/dashboard/app/ExternalLinkPicker.js'
import {ImagePicker} from '#/dashboard/app/ImagePicker.js'
import {LinkPicker} from '#/dashboard/app/LinkPicker.js'
import {InsertionSeparator} from '#/dashboard/app/ui/InsertionSeparator.js'
import {Surface, SurfaceHeader} from '#/dashboard/app/ui/Surface.js'
import {nav} from '#/dashboard/DashboardNav.js'
import {
  useDashboard,
  useField,
  useFieldNode,
  useFieldOptions,
  useNodes
} from '#/dashboard/hooks.js'
import {
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundAttachFile,
  IcRoundClose,
  IcRoundEdit,
  IcRoundLink,
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
import type {EntryPickerOptions} from '#/picker/entry.js'
import styler from '@alinea/styler'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import type {ComponentType, ReactNode} from 'react'
import {useMemo, useRef, useState} from 'react'
import {
  type DragItem,
  DragPreview,
  type DragPreviewRenderer,
  useDrag
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
  const type = useAtomValue(entry.type)
  const parentIds = useAtomValue(entry.parentIds)
  const [parentsPending, parents] = useAtomValue(entry.parentsState)
  return (
    <span className={styles.LinkFieldView.label()}>
      {image && !textOnly && (
        <EntryRowImage entry={entry} hasFields={hasFields} />
      )}
      <span className={styles.LinkFieldView.labelText()}>
        <span className={styles.LinkFieldView.title()}>
          {label} ({type.label})
        </span>
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
  picker: Picker<LinkFieldRow>
  selection?: Array<LinkFieldRow>
  type: PickerType
  value?: LinkFieldRow
  onPick: (value: LinkFieldRow) => void
  onPickMany?: (value: Array<LinkFieldRow>) => void
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
  buttonSize = 'small',
  children,
  className,
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
  if (type === 'url') {
    return (
      <DialogTrigger>
        <Button
          aria-label={ariaLabel}
          appearance={buttonAppearance}
          className={className}
          icon={buttonIcon}
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
  const options = picker.options as Partial<EntryPickerOptions>
  const condition =
    typeof options.condition === 'function' ? undefined : options.condition
  const fallbackRoot =
    type === 'file' || type === 'image' ? selectedMediaRoot : selectedRoot
  const fallbackLocation =
    selectedWorkspace && fallbackRoot
      ? {workspace: selectedWorkspace, root: fallbackRoot}
      : undefined
  const location =
    typeof options.location === 'function'
      ? fallbackLocation
      : (options.location ?? fallbackLocation)
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
          size={buttonSize}
        >
          {children}
        </Button>
        <ImagePicker
          {...pickerProps}
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
        size={buttonSize}
      >
        {children}
      </Button>
      <LinkPicker {...pickerProps} />
    </DialogTrigger>
  )
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
    <div className={styles.MultipleLinksFieldView.create()}>
      {Object.entries(options.pickers).map(([type, picker]) => (
        <LinkPickerAction
          className={styles.MultipleLinksFieldView.createButton()}
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
  className: string
}

function LinkRowEditor({className, node, picker}: LinkRowEditorProps) {
  if (!picker?.fields) return null
  return (
    <div className={className}>
      <NodeEditor node={node as ReactiveNode<object>} type={picker.fields} />
    </div>
  )
}

interface SingleLinkRowProps extends StandardFieldActionProps {
  node: ReactiveNode<LinkFieldRow>
  value: LinkFieldRow
}

interface LinkRowActionsProps {
  className: string
  isFirst?: boolean
  isLast?: boolean
  picker?: Picker<LinkFieldRow>
  type: PickerType
  value: LinkFieldRow
  onMoveDown?: () => void
  onMoveUp?: () => void
  onPick: (value: LinkFieldRow) => void
  onRemove: () => void
}

function LinkRowActions({
  className,
  isFirst = true,
  isLast = true,
  picker,
  type,
  value,
  onMoveDown,
  onMoveUp,
  onPick,
  onRemove
}: LinkRowActionsProps) {
  return (
    <div className={className}>
      <LinkRowOpenAction type={type} value={value} />
      {picker && (
        <LinkPickerAction
          ariaLabel="Edit link"
          buttonAppearance="plain"
          buttonIcon={IcRoundEdit}
          buttonSize="icon-small"
          onPick={onPick}
          picker={picker}
          type={type}
          value={value}
        />
      )}
      {onMoveUp && (
        <Button
          aria-label="Move link up"
          appearance="plain"
          isDisabled={isFirst}
          onPress={onMoveUp}
          size="icon-small"
          icon={IcRoundArrowUpward}
        />
      )}
      {onMoveDown && (
        <Button
          aria-label="Move link down"
          appearance="plain"
          isDisabled={isLast}
          onPress={onMoveDown}
          size="icon-small"
          icon={IcRoundArrowDownward}
        />
      )}
      <Button
        aria-label="Remove link"
        appearance="plain"
        size="icon-small"
        icon={IcRoundClose}
        onPress={onRemove}
      />
    </div>
  )
}

interface LinkRowOpenActionProps {
  type: PickerType
  value: LinkFieldRow
}

function LinkRowOpenAction({type, value}: LinkRowOpenActionProps) {
  if (!('_entry' in value)) return null
  return <EntryLinkOpenButton entryId={value._entry} type={type} />
}

interface EntryLinkOpenButtonProps {
  entryId: string
  type: PickerType
}

function EntryLinkOpenButton({entryId, type}: EntryLinkOpenButtonProps) {
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
        size="icon-small"
      />
    )
  }
  return (
    <LoadedEntryLinkOpenButton
      entry={data}
      locale={type === 'entry' ? route.locale : undefined}
    />
  )
}

interface LoadedEntryLinkOpenButtonProps {
  entry: DashboardEntryData
  locale?: string
}

function LoadedEntryLinkOpenButton({
  entry,
  locale
}: LoadedEntryLinkOpenButtonProps) {
  const workspace = useAtomValue(entry.workspaceKey)
  const root = useAtomValue(entry.rootKey)
  const href = `#${nav.entry(workspace, root, entry.entry.id, locale)}`
  return (
    <Button
      aria-label="Open link"
      appearance="plain"
      icon={IcRoundOpenInNew}
      onPress={() => window.open(href, '_blank', 'noopener,noreferrer')}
      size="icon-small"
    />
  )
}

function SingleLinkRow({field, node, value}: SingleLinkRowProps) {
  const [, setValue] = useField(field)
  const options = useFieldOptions(field)
  const type = getPickerType(value[Reference.type])
  const picker = options.pickers[type] as Picker<LinkFieldRow> | undefined
  return (
    <>
      <SurfaceHeader className={styles.LinkFieldView.row()}>
        <div className={styles.LinkFieldView.actions()}>
          <LinkRow hasFields={Boolean(picker?.fields)} node={node} />
        </div>
        {!options.readOnly && (
          <LinkRowActions
            className={styles.LinkFieldView.actions()}
            onPick={setValue}
            onRemove={() => setValue(undefined!)}
            picker={picker}
            type={type}
            value={value}
          />
        )}
      </SurfaceHeader>
      <LinkRowEditor
        className={styles.LinkFieldView.fields()}
        node={node}
        picker={picker}
      />
    </>
  )
}

interface MultipleLinkRowProps {
  expanded: boolean
  field: LinksField<LinkFieldRow, unknown>
  index: number
  list: ReactiveNode<Array<LinkFieldRow>>
  node: ReactiveNode<LinkFieldRow>
  onMoveRow: (rowId: string, targetIndex: number) => void
  onToggleRow: (rowId: string) => void
  rows: number
  value?: LinkFieldRow
}

interface LinkFieldSeparatorProps {
  isTop?: boolean
  label: string
  position: 'before' | 'after'
  readOnly: boolean
  onMoveRow: (rowId: string, targetIndex: number) => void
  targetIndex: number
}

function LinkFieldSeparator({
  isTop,
  label,
  position,
  readOnly,
  onMoveRow,
  targetIndex
}: LinkFieldSeparatorProps) {
  return (
    <InsertionSeparator
      dragType={LINK_FIELD_ROW_DRAG_TYPE}
      label={label}
      onMoveRow={onMoveRow}
      placement={isTop ? 'edge' : 'between'}
      position={position}
      readOnly={readOnly}
      targetIndex={targetIndex}
    />
  )
}

interface LinkFieldDragPreviewProps {
  icon: ComponentType
  label: ReactNode
}

function LinkFieldDragPreview({icon, label}: LinkFieldDragPreviewProps) {
  return (
    <div className={styles.MultipleLinksFieldRow.dragPreview()}>
      <div className={styles.MultipleLinksFieldRow.dragPreviewIcon()}>
        <Icon aria-hidden icon={icon} />
      </div>
      <strong className={styles.MultipleLinksFieldRow.dragPreviewTitle()}>
        {label}
      </strong>
    </div>
  )
}

function MultipleLinkRow({
  expanded,
  field,
  index,
  list,
  node,
  onMoveRow,
  onToggleRow,
  rows,
  value
}: MultipleLinkRowProps) {
  const [, setValue] = useField(field)
  const options = useFieldOptions(field)
  const moveRow = useSetAtom(list.move)
  if (!value) return null
  const type = getPickerType(value[Reference.type])
  const picker = options.pickers[type] as Picker<LinkFieldRow> | undefined
  const itemId = value[Reference.id]
  const readOnly = Boolean(options.readOnly)
  const dragPreview = useRef<DragPreviewRenderer | null>(null)
  const {dragProps, isDragging} = useDrag({
    getItems() {
      return [dragRowItem(itemId)]
    },
    getAllowedDropOperations() {
      return ['move']
    },
    isDisabled: readOnly,
    preview: dragPreview
  })

  function moveCurrentRow(direction: -1 | 1) {
    moveRow(index, index + direction)
  }

  return (
    <>
      <section
        aria-label={`Link item ${index + 1}`}
        className={styles.MultipleLinksFieldRow()}
        data-dragging={isDragging || undefined}
        data-first-row={index === 0 ? 'true' : undefined}
        role="listitem"
      >
        <SurfaceHeader
          className={styles.MultipleLinksFieldRow.header()}
          data-first-row={index === 0 ? 'true' : undefined}
        >
          <DragPreview ref={dragPreview}>
            {() => (
              <LinkFieldDragPreview
                icon={getLinkIcon(type)}
                label={<LinkRowText node={node} />}
              />
            )}
          </DragPreview>
          <div
            {...dragProps}
            aria-label={`Drag link item ${index + 1}`}
            className={styles.MultipleLinksFieldRow.drag()}
            data-dragging={isDragging || undefined}
          >
            <Button
              appearance="plain"
              aria-label={expanded ? 'Collapse link' : 'Expand link'}
              className={styles.MultipleLinksFieldRow.toggle()}
              data-expanded={expanded ? 'true' : undefined}
              onPress={() => onToggleRow(itemId)}
            >
              <LinkRow hasFields={Boolean(picker?.fields)} node={node} />
              <FoldIcon
                aria-hidden
                className={styles.MultipleLinksFieldRow.foldIcon()}
                expanded={expanded}
              />
            </Button>
          </div>
          {!readOnly && (
            <LinkRowActions
              className={styles.MultipleLinksFieldView.actions()}
              isFirst={index === 0}
              isLast={index === rows - 1}
              onMoveDown={() => moveCurrentRow(1)}
              onMoveUp={() => moveCurrentRow(-1)}
              onPick={link => {
                setValue(links =>
                  links.map((current, currentIndex) =>
                    currentIndex === index ? link : current
                  )
                )
              }}
              onRemove={() =>
                setValue(links =>
                  links.filter((_, currentIndex) => currentIndex !== index)
                )
              }
              picker={picker}
              type={type}
              value={value}
            />
          )}
        </SurfaceHeader>
        {expanded && (
          <LinkRowEditor
            className={styles.MultipleLinksFieldRow.body()}
            node={node}
            picker={picker}
          />
        )}
        {!expanded && picker?.fields && (
          <div className={styles.MultipleLinksFieldRow.footer()}>
            <CompactRecordFields
              fields={Type.fields(picker.fields)}
              layout="footer"
              value={value}
            />
          </div>
        )}
      </section>
      <LinkFieldSeparator
        label="link"
        onMoveRow={onMoveRow}
        position="after"
        readOnly={readOnly}
        targetIndex={insertIndex(index, 'after')}
      />
    </>
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
  return (
    <Label label={options.label} shared={options.shared}>
      <Surface className={styles.LinkFieldView()}>
        {selectedValue && (
          <SingleLinkRow
            field={field}
            node={node as ReactiveNode<LinkFieldRow>}
            value={selectedValue}
          />
        )}
        {isEmpty && (
          <SurfaceHeader
            className={styles.LinkFieldView.row(
              styles.LinkFieldView.rowCenter()
            )}
          >
            <div className={styles.LinkFieldView.createActions()}>
              <SingleLinkCreateActions field={field} />
            </div>
          </SurfaceHeader>
        )}
      </Surface>
    </Label>
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
  const [foldedIds, setFoldedIds] = useState<Set<string>>(new Set())
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

  return (
    <>
      <Button
        aria-label={
          hasRows
            ? allExpanded
              ? 'Collapse all links'
              : 'Expand all links'
            : 'No links to fold'
        }
        appearance="plain"
        className={styles.MultipleLinksFieldView.label()}
        data-has-rows={hasRows ? 'true' : undefined}
        isDisabled={!hasRows}
        onPress={toggleAll}
      >
        {options.label}
        {options.shared && <SharedLabelBadge />}
        <FoldIcon aria-hidden data-slot="icon" expanded={allExpanded} />
      </Button>
      {hasRows && !readOnly && (
        <LinkFieldSeparator
          isTop
          label="link"
          onMoveRow={moveRow}
          position="before"
          readOnly={readOnly}
          targetIndex={0}
        />
      )}
      <Surface className={styles.MultipleLinksFieldView()}>
        {nodes.length > 0 && (
          <div aria-label={options.label || 'Links'} role="list">
            {nodes.map((node, index) => (
              <MultipleLinkRow
                expanded={!foldedIds.has(links[index]?._id || '')}
                field={field}
                index={index}
                key={links[index]?._id || index}
                list={list}
                node={node}
                onMoveRow={moveRow}
                onToggleRow={toggleRow}
                rows={nodes.length}
                value={links[index]}
              />
            ))}
          </div>
        )}
        <SurfaceHeader
          className={styles.MultipleLinksFieldView.row(
            styles.MultipleLinksFieldView.rowCenter()
          )}
        >
          <div className={styles.MultipleLinksFieldView.createActions()}>
            <MultipleLinkCreateActions field={field} />
          </div>
        </SurfaceHeader>
      </Surface>
    </>
  )
}
