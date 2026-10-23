import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  SortableListItem,
  type DragMoveEvent,
  SortableList,
  SortableListItemTitle,
  SortableListAdd,
  ListError,
  ListLabel,
  SortableListItemActions,
  SortableListItemContent,
  SortableListItemToggle,
  SortableListItemHeader,
  SortableListItemDescription,
  SortableListItemHandle,
  SortableListItemInsert,
  SortableListItemTrigger,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetTitle,
  TextField,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '#/components.js'
import {createId} from '#/core/Id.js'
import {Field} from '#/core/Field.js'
import {getType} from '#/core/Internal.js'
import {ListRow} from '#/core/ListRow.js'
import {Schema} from '#/core/Schema.js'
import {Section} from '#/core/Section.js'
import {Type} from '#/core/Type.js'
import {entries, keys} from '#/core/util/Objects.js'
import {slugify} from '#/core/util/Slugs.js'
import {Badge} from '#/components.js'
import {
  BlockSheet,
  type BlockSheetState,
  useBlockSheet,
  useOpenBlockSheet
} from '#/dashboard/app/BlockSheet.js'
import {BlockTabs} from '#/dashboard/app/BlockTabs.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
  useEntry,
  useFieldError,
  useFieldNode,
  useFieldOptions,
  useNodes
} from '#/dashboard/hooks.js'
import {
  IcBaselineContentCopy,
  IcBaselineContentPasteGo,
  IcRoundAdd,
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundClose,
  IcRoundDelete,
  IcRoundFirstPage,
  IcRoundLastPage,
  IcRoundLink,
  IcRoundMoreHoriz
} from '#/dashboard/icons.js'
import {ListOptions} from '#/field/list.js'
import {SlugField} from '#/field/path/SlugField.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw, useSetAtom, useStore} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import type {ComponentType, KeyboardEvent, ReactNode} from 'react'
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import css from './ListField.module.css'

const styles = styler(css)

interface ListValue {
  _id: string
  _type: string
  [key: string]: unknown
}

const copyAtom = atomWithStorage<ListValue | undefined>(
  '@alinea/copypaste',
  undefined
)

export interface ListFieldTypeItem {
  id: string
  label: string
  type: Schema[string]
  /** The heading the type is listed under in the type picker */
  group?: string
}

export interface ListFieldBadgesProps {
  row: ReactiveNode<ListValue>
}

interface ListFieldPickerOption {
  id: string
  label: string
  icon: ComponentType
  typeItem?: ListFieldTypeItem
  pasted?: ListValue
}

export interface ListFieldViewProps {
  field: Field<Array<ListRow>>
  /**
   * The field that names a row, in place of the label and anchor editors give
   * it in its settings
   */
  labelField?: string
  /** Shown in the header of a row, after its name */
  badges?: ComponentType<ListFieldBadgesProps>
  /** One button with this label adds a row, instead of one per type */
  addLabel?: string
  /** The heading a type is listed under in the type picker */
  typeGroup?: (id: string) => string | undefined
}

export function ListFieldView({
  field,
  labelField,
  badges,
  addLabel,
  typeGroup
}: ListFieldViewProps) {
  const options = useFieldOptions(field) as ListOptions<Schema>
  const error = useFieldError(field)
  const list = useFieldNode(field) as ReactiveNode<Array<ListValue>>
  const nodes = useNodes(list) as Array<ReactiveNode<ListValue>>
  const pushRow = useSetAtom(list.push)
  const insertRow = useSetAtom(list.insert)
  const pasted = useAtomValueRaw(copyAtom)
  const schemaEntries = useMemo(
    () => Object.entries(options.schema),
    [options.schema]
  )
  const typeItems = useMemo(
    () =>
      schemaEntries.map(([id, type]) => ({
        id,
        label: Type.label(type),
        type,
        group: typeGroup?.(id)
      })),
    [schemaEntries, typeGroup]
  )
  const readOnly = Boolean(options.readOnly)
  // A fold without a label next to it is a stray chevron
  const labelled = Boolean(options.label)
  const hasRows = nodes.length > 0
  const canCreate = options.max === undefined || nodes.length < options.max
  const rowIdsAtom = useMemo(
    () =>
      atom(get => {
        const nodes = get(list.nodes) as Array<ReactiveNode<ListValue>>
        return nodes.map(node => get(node.field('_id')) as string)
      }),
    [list]
  )
  const rowIds = useAtomValueRaw(rowIdsAtom)
  const [foldedIds, setFoldedIds] = useState<Set<string>>(
    () => new Set(options.collapsed ? rowIds : [])
  )
  const moveRowAtom = useMemo(
    () =>
      atom(null, (get, set, {keys, target}: DragMoveEvent) => {
        const nodes = get(list.nodes) as Array<ReactiveNode<ListValue>>
        const ids = nodes.map(node => get(node.field('_id')))
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
  const copyRowAtom = useMemo(
    () =>
      atom(null, (get, set, rowId: string) => {
        const nodes = get(list.nodes) as Array<ReactiveNode<ListValue>>
        const node = nodes.find(node => get(node.field('_id')) === rowId)
        if (node) set(copyAtom, get(node.value))
      }),
    [list]
  )
  const copyRow = useSetAtom(copyRowAtom)
  const allExpanded = nodes.length > 0 && rowIds.every(id => !foldedIds.has(id))

  function toggleAll() {
    setFoldedIds(allExpanded ? new Set(rowIds) : new Set())
  }

  // Stable callbacks keep memoized rows from rendering on unrelated changes
  const toggleRow = useCallback((rowId: string) => {
    setFoldedIds(current => {
      const next = new Set(current)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }, [])

  const openSheet = useOpenBlockSheet()
  const compact = Boolean(options.compact)
  // The compact row to focus once it renders, after Enter or Backspace
  const [focus, setFocus] = useState<RowFocus>()
  const setUp = useCallback(
    (row: ListValue) => {
      const type = options.schema[row._type]
      if (!type) return
      // Rows named by a field or without fields to fold are set up in their
      // settings, opened after the picker returns focus, which would close
      // the sheet again
      if (labelField || Type.sections(type).length === 0)
        setTimeout(() => openSheet(row._id))
    },
    [options.schema, openSheet, labelField]
  )
  const insertNewRow = useCallback(
    (index: number, row: ListValue) => {
      insertRow(index, row)
      setUp(row)
    },
    [insertRow, setUp]
  )

  function addRow(typeName: string, type: Schema[string]) {
    const row = createRow(typeName, type)
    pushRow(row)
    setUp(row)
  }

  const content = (hasRows || !readOnly) && (
    <SortableList
      aria-label={options.label || 'List items'}
      onReorder={readOnly ? undefined : moveRow}
    >
      {nodes.map((row, index) => (
        <ListFieldRow
          key={rowIds[index] || index}
          onInsertRow={insertNewRow}
          canCreate={canCreate}
          expanded={!foldedIds.has(rowIds[index])}
          index={index}
          list={list}
          readOnly={readOnly}
          onCopyRow={copyRow}
          onToggleRow={toggleRow}
          row={row}
          rows={nodes.length}
          schema={options.schema}
          pasted={pasted}
          typeItems={typeItems}
          labelField={labelField}
          badges={badges}
          compact={compact}
          focus={focus?.id === rowIds[index] ? focus.at : undefined}
          onFocusRow={setFocus}
        />
      ))}
      {!readOnly && canCreate && (
        <SortableListAdd>
          <ListFieldCreateActions
            addLabel={addLabel}
            items={typeItems}
            pasted={pasted && options.schema[pasted._type] ? pasted : undefined}
            onPaste={row => pushRow(cloneRow(row))}
            onSelect={item => addRow(item.id, item.type)}
          />
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
              ? 'Collapse all items'
              : 'Expand all items'
            : 'No list items to fold'
        }
        expanded={allExpanded}
        hasRows={hasRows}
        disabled={!hasRows}
        onClick={toggleAll}
        description={options.help}
        shared={options.shared}
        showFold={labelled && !compact}
        inline={options.inline || !labelled}
      >
        {options.label}
      </ListLabel>
      {content}
      {error && <ListError>{error}</ListError>}
    </>
  )
}

export function insertIndex(
  rowIndex: number,
  position: 'before' | 'after'
): number {
  return position === 'before' ? rowIndex : rowIndex + 1
}

export function reorderIndex(fromIndex: number, targetIndex: number): number {
  return fromIndex < targetIndex ? targetIndex - 1 : targetIndex
}

function createRow(typeName: string, type: Schema[string]): ListValue {
  const initialValue = Type.initialValue(type) as Record<string, unknown>
  return {
    _id: createId(),
    _index: '',
    _type: typeName,
    ...initialValue
  }
}

function cloneRow(row: ListValue): ListValue {
  return {
    ...row,
    _id: createId(),
    _index: ''
  }
}

function pasteBlockLabel(
  row: ListValue,
  items: Array<ListFieldTypeItem>
): string {
  const item = items.find(item => item.id === row._type)
  return item ? `Paste ${item.label}` : 'Paste block'
}

interface ListFieldCreateActionsProps {
  addLabel?: string
  items: Array<ListFieldTypeItem>
  pasted?: ListValue
  onPaste: (row: ListValue) => void
  onSelect: (item: ListFieldTypeItem) => void
}

function ListFieldCreateActions({
  addLabel,
  items,
  pasted,
  onPaste,
  onSelect
}: ListFieldCreateActionsProps) {
  if (addLabel)
    return (
      <div className={styles.ListFieldCreateActions()}>
        <ListFieldTypePicker
          items={items}
          label={addLabel}
          triggerLabel={addLabel}
          pasted={pasted}
          pasteLabel={pasted ? pasteBlockLabel(pasted, items) : undefined}
          onPaste={onPaste}
          onSelect={onSelect}
        />
      </div>
    )
  const visibleItems = items.slice(0, 3)
  const hasMenu = items.length > visibleItems.length
  return (
    <div className={styles.ListFieldCreateActions()}>
      {pasted && (
        <Button
          className={styles.ListFieldCreateActions.button()}
          onClick={() => onPaste(pasted)}
          size="sm"
          icon={IcBaselineContentPasteGo}
          variant="ghost"
        >
          {pasteBlockLabel(pasted, items)}
        </Button>
      )}
      {visibleItems.map(item => (
        <Button
          className={styles.ListFieldCreateActions.button()}
          key={item.id}
          onClick={() => onSelect(item)}
          size="sm"
          icon={getType(item.type).icon || IcRoundAdd}
          variant="ghost"
        >
          {item.label}
        </Button>
      ))}
      {hasMenu && (
        <ListFieldTypePicker
          items={items}
          label="More block types"
          pasted={pasted}
          pasteLabel={pasted ? pasteBlockLabel(pasted, items) : undefined}
          triggerIcon={IcRoundMoreHoriz}
          onPaste={onPaste}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}

interface ListFieldRowProps {
  canCreate: boolean
  index: number
  list: ReactiveNode<Array<ListValue>>
  readOnly: boolean
  row: ReactiveNode<ListValue>
  rows: number
  schema: Schema
  typeItems: Array<ListFieldTypeItem>
  pasted?: ListValue
  expanded: boolean
  labelField?: string
  badges?: ComponentType<ListFieldBadgesProps>
  compact: boolean
  /** Where to put the caret in the first input of this compact row */
  focus?: RowFocus['at']
  onFocusRow: (focus: RowFocus) => void
  onToggleRow: (rowId: string) => void
  onCopyRow: (rowId: string) => void
  onInsertRow: (index: number, row: ListValue) => void
}

const ListFieldRow = memo(function ListFieldRow({
  canCreate,
  index,
  list,
  readOnly,
  row,
  rows,
  schema,
  typeItems,
  pasted,
  expanded: isExpanded,
  labelField,
  badges: Badges,
  compact,
  focus,
  onFocusRow,
  onToggleRow,
  onCopyRow,
  onInsertRow
}: ListFieldRowProps) {
  const itemId = useAtomValueRaw(row.field('_id')) as string
  const typeName = useAtomValueRaw(row.field('_type')) as string
  // A compact row is named by its first field
  const nameField =
    labelField ?? (compact ? firstField(schema[typeName]) : undefined)
  const customLabelValue = useAtomValueRaw(row.field(nameField ?? '_label')) as
    | string
    | undefined
  const anchorValue = useAtomValueRaw(row.field('_anchor')) as
    | string
    | undefined
  const customLabel = customLabelValue ?? ''
  const setCustomLabel = useSetAtom(row.field('_label'))
  const setAnchor = useSetAtom(row.field('_anchor'))
  const moveListRow = useSetAtom(list.move)
  const removeRow = useSetAtom(list.remove)
  const sheet = useBlockSheet(itemId)
  const type = schema[typeName]
  if (!type) return null

  const label = Type.label(type)
  const typeIcon = getType(type).icon
  // Rows that keep all their fields in tabs have nothing to fold
  const expandable = Type.sections(type).length > 0
  const expanded = expandable && isExpanded

  function deleteRow() {
    removeRow(index)
  }

  function updateCustomLabel(nextValue: string) {
    setCustomLabel(nextValue || undefined)
    const currentLabelSlug = slugify(customLabel)
    const shouldSyncAnchor =
      anchorValue === undefined || anchorValue === currentLabelSlug
    if (shouldSyncAnchor) setAnchor(slugify(nextValue) || undefined)
  }

  function updateAnchor(nextValue: string) {
    setAnchor(slugify(nextValue.replace(/^#+/, '')) || undefined)
  }

  const sheetContent = (
    <BlockSheet id={itemId}>
      <ListFieldRowSheet
        anchor={nameField ? undefined : anchorValue}
        labels={!nameField}
        tabs={
          <BlockTabs
            node={row as ReactiveNode<object>}
            type={type}
            readOnly={readOnly}
          />
        }
        canInsert={canCreate}
        customLabel={customLabel}
        isFirstRow={index === 0}
        isLastRow={index === rows - 1}
        items={typeItems}
        label={label}
        pasted={pasted && schema[pasted._type] ? pasted : undefined}
        readOnly={readOnly}
        typeIcon={typeIcon}
        onAnchorChange={updateAnchor}
        onClose={() => sheet.setOpen(false)}
        onCopy={() => onCopyRow(itemId)}
        onCustomLabelChange={updateCustomLabel}
        onDelete={deleteRow}
        onInsertAfter={value => onInsertRow(insertIndex(index, 'after'), value)}
        onInsertBefore={value =>
          onInsertRow(insertIndex(index, 'before'), value)
        }
        onMoveDown={() => moveListRow(index, index + 1)}
        onMoveUp={() => moveListRow(index, index - 1)}
      />
    </BlockSheet>
  )

  if (compact)
    return (
      <>
        <ListFieldCompactRow
          index={index}
          label={label}
          list={list}
          readOnly={readOnly}
          row={row}
          sheet={sheet}
          type={type}
          typeName={typeName}
          focus={focus}
          onDelete={deleteRow}
          onFocusRow={onFocusRow}
          onInsertRow={onInsertRow}
        />
        {sheetContent}
      </>
    )

  return (
    <>
      <SortableListItem
        aria-label={`${label} item ${index + 1}`}
        current={sheet.open}
        id={itemId}
      >
        {canCreate && !readOnly && (
          <ListFieldInsertGap
            items={typeItems}
            label={`Insert before ${label} item ${index + 1}`}
            pasted={pasted && schema[pasted._type] ? pasted : undefined}
            onInsert={value => onInsertRow(insertIndex(index, 'before'), value)}
          />
        )}
        <ListFieldRowHeader
          expanded={expanded}
          label={label}
          customLabel={customLabel}
          anchor={labelField ? undefined : anchorValue}
          badges={Badges && <Badges row={row} />}
          readOnly={readOnly}
          sheet={sheet}
          typeIcon={typeIcon}
          onDelete={deleteRow}
          onToggle={expandable ? () => onToggleRow(itemId) : undefined}
        />
        {expanded && (
          <SortableListItemContent>
            <NodeEditor node={row as ReactiveNode<object>} type={type} />
          </SortableListItemContent>
        )}
      </SortableListItem>
      {/* Outside the item so events in the sheet don't reach its handlers */}
      {sheetContent}
    </>
  )
})

interface ListFieldInsertGapProps {
  items: Array<ListFieldTypeItem>
  label: string
  pasted?: ListValue
  onInsert: (row: ListValue) => void
}

/** Inserts a row on the border above a row, picking its type if needed */
function ListFieldInsertGap({
  items,
  label,
  pasted,
  onInsert
}: ListFieldInsertGapProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const direct = !pasted && items.length === 1 ? items[0] : undefined

  function insert(row: ListValue) {
    onInsert(row)
    setOpen(false)
  }

  return (
    <>
      <SortableListItemInsert
        ref={ref}
        aria-label={label}
        aria-haspopup={direct ? undefined : 'dialog'}
        aria-expanded={direct ? undefined : open}
        onClick={() => {
          if (direct) onInsert(createRow(direct.id, direct.type))
          else setOpen(true)
        }}
      />
      {!direct && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverAnchor virtualRef={ref} />
          <PopoverContent
            aria-label={label}
            align="start"
            className={styles.ListFieldTypePicker.popover()}
          >
            <ListFieldTypeCommand
              items={items}
              label={label}
              pasted={pasted}
              pasteLabel={pasted ? pasteBlockLabel(pasted, items) : undefined}
              onPaste={row => insert(cloneRow(row))}
              onSelect={item => insert(createRow(item.id, item.type))}
            />
          </PopoverContent>
        </Popover>
      )}
    </>
  )
}

function rowAnchor(customLabel: string, anchor?: string): string {
  return (anchor ?? slugify(customLabel.trim())).trim()
}

interface ListFieldRowHeaderProps {
  expanded: boolean
  label: string
  customLabel: string
  anchor?: string
  badges?: ReactNode
  readOnly: boolean
  sheet: BlockSheetState
  typeIcon?: ComponentType
  onDelete: () => void
  /** Left out for rows without fields to fold */
  onToggle?: () => void
}

function ListFieldRowHeader({
  expanded,
  label,
  customLabel,
  anchor,
  badges,
  readOnly,
  sheet,
  typeIcon,
  onDelete,
  onToggle
}: ListFieldRowHeaderProps) {
  const displayLabel = customLabel.trim()
  const displayAnchor = rowAnchor(customLabel, anchor)
  const showAnchor = Boolean(displayAnchor && !displayLabel)
  const title = (
    <>
      <Badge icon={typeIcon} size="sm" color="primary">
        {label}
      </Badge>
      {displayLabel && (
        <SortableListItemDescription>
          {displayLabel}
        </SortableListItemDescription>
      )}
      {showAnchor && <Badge size="sm">#{displayAnchor}</Badge>}
      {badges}
    </>
  )
  return (
    <SortableListItemHeader>
      <SortableListItemTitle>
        {onToggle && (
          <SortableListItemToggle
            aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
            expanded={expanded}
            onClick={onToggle}
          />
        )}
        {sheet.available ? (
          <SortableListItemTrigger
            {...sheet.triggerProps}
            aria-label={`${label} settings`}
            aria-expanded={sheet.open}
            onClick={() => {
              // Opening the settings shows the row they belong to
              if (!sheet.open && !expanded) onToggle?.()
              sheet.toggle()
            }}
          >
            {title}
          </SortableListItemTrigger>
        ) : (
          title
        )}
      </SortableListItemTitle>
      <SortableListItemActions>
        <Button
          variant="ghost"
          aria-label={`Remove ${label}`}
          icon={IcRoundClose}
          disabled={readOnly}
          onClick={onDelete}
          size="icon-sm"
        />
      </SortableListItemActions>
    </SortableListItemHeader>
  )
}

type InsertPosition = 'before' | 'after'

interface RowFocus {
  id: string
  at: 'start' | 'end'
}

/** The key of the first field a row shows, outside its tabs */
function firstField(type: Type | undefined): string | undefined {
  const [section] = type ? Type.sections(type) : []
  return section && keys(Section.fields(section))[0]
}

interface ListFieldCompactRowProps {
  index: number
  label: string
  list: ReactiveNode<Array<ListValue>>
  readOnly: boolean
  row: ReactiveNode<ListValue>
  sheet: BlockSheetState
  type: Type
  typeName: string
  focus?: RowFocus['at']
  onDelete: () => void
  onFocusRow: (focus: RowFocus) => void
  onInsertRow: (index: number, row: ListValue) => void
}

/**
 * A row on one line with its fields side by side. Enter adds a row below,
 * Backspace in an empty row removes it, its tabs open in the sheet.
 */
function ListFieldCompactRow({
  index,
  label,
  list,
  readOnly,
  row,
  sheet,
  type,
  typeName,
  focus,
  onDelete,
  onFocusRow,
  onInsertRow
}: ListFieldCompactRowProps) {
  const store = useStore()
  const fields = useRef<HTMLDivElement>(null)
  const itemId = useAtomValueRaw(row.field('_id')) as string
  const name = `${label} item ${index + 1}`

  useLayoutEffect(() => {
    if (!focus) return
    const input = fields.current?.querySelector<HTMLInputElement>(
      'input:not([type="hidden"]), textarea'
    )
    if (!input) return
    input.focus()
    if (focus === 'end' && 'setSelectionRange' in input)
      input.setSelectionRange(input.value.length, input.value.length)
  }, [focus])

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target
    if (readOnly || event.nativeEvent.isComposing) return
    if (!(target instanceof HTMLInputElement)) return
    // Pickers and comboboxes use these keys themselves
    if (target.getAttribute('role') === 'combobox') return
    if (event.key === 'Enter') {
      event.preventDefault()
      const next = createRow(typeName, type)
      onInsertRow(index + 1, next)
      onFocusRow({id: next._id, at: 'start'})
      return
    }
    if (event.key !== 'Backspace' || target.value) return
    const value = store.get(row.value) as Record<string, unknown>
    const empty = entries(Type.fields(type)).every(([key, field]) =>
      Field.isEmpty(field, value[key])
    )
    const nodes = store.get(list.nodes) as Array<ReactiveNode<ListValue>>
    if (!empty || nodes.length < 2) return
    event.preventDefault()
    const neighbour = nodes[index - 1] ?? nodes[index + 1]
    onFocusRow({
      id: store.get(neighbour.field('_id')) as string,
      at: index > 0 ? 'end' : 'start'
    })
    onDelete()
  }

  return (
    <SortableListItem
      aria-label={name}
      current={sheet.open}
      id={itemId}
      className={styles.ListFieldCompactRow()}
    >
      {!readOnly && <SortableListItemHandle aria-label={`Move ${name}`} />}
      <div
        ref={fields}
        className={styles.ListFieldCompactRow.fields()}
        onKeyDown={keyDown}
      >
        <NodeEditor
          node={row as ReactiveNode<object>}
          type={type}
          readOnly={readOnly}
          inline
        />
      </div>
      {sheet.available && (
        <Button
          {...sheet.triggerProps}
          variant="ghost"
          size="icon-sm"
          icon={IcRoundMoreHoriz}
          aria-label={`${label} settings`}
          aria-expanded={sheet.open}
          onClick={() => sheet.toggle()}
        />
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        icon={IcRoundClose}
        aria-label={`Remove ${name}`}
        disabled={readOnly}
        onClick={onDelete}
      />
    </SortableListItem>
  )
}

interface ListFieldRowSheetProps {
  anchor?: string
  /** Edit the label and anchor of the row */
  labels: boolean
  /** The tabs of the row's type, rendered below the label and anchor */
  tabs?: ReactNode
  canInsert: boolean
  customLabel: string
  isFirstRow: boolean
  isLastRow: boolean
  items: Array<ListFieldTypeItem>
  label: string
  pasted?: ListValue
  readOnly: boolean
  typeIcon?: ComponentType
  onAnchorChange: (value: string) => void
  onClose: () => void
  onCopy: () => void
  onCustomLabelChange: (value: string) => void
  onDelete: () => void
  onInsertAfter: (value: ListValue) => void
  onInsertBefore: (value: ListValue) => void
  onMoveDown: () => void
  onMoveUp: () => void
}

function ListFieldRowSheet({
  anchor,
  labels,
  tabs,
  canInsert,
  customLabel,
  isFirstRow,
  isLastRow,
  items,
  label,
  pasted,
  readOnly,
  typeIcon,
  onAnchorChange,
  onClose,
  onCopy,
  onCustomLabelChange,
  onDelete,
  onInsertAfter,
  onInsertBefore,
  onMoveDown,
  onMoveUp
}: ListFieldRowSheetProps) {
  const [insertPosition, setInsertPosition] = useState<InsertPosition | null>(
    null
  )
  const entryUrl = useEntry()?.url
  const displayLabel = customLabel.trim()
  const displayAnchor = rowAnchor(customLabel, anchor)
  const title = displayLabel || (displayAnchor && `#${displayAnchor}`) || label
  const link =
    entryUrl && displayAnchor ? `${entryUrl}#${displayAnchor}` : undefined

  function insert(position: InsertPosition, row: ListValue) {
    if (position === 'after') onInsertAfter(row)
    else onInsertBefore(row)
    onClose()
  }

  function startInsert(position: InsertPosition) {
    // A single block type needs no picker
    const only = !pasted && items.length === 1 ? items[0] : undefined
    if (only) insert(position, createRow(only.id, only.type))
    else setInsertPosition(position)
  }

  function copy() {
    onCopy()
    onClose()
  }

  return (
    <SheetContent onClose={onClose}>
      <SheetHeader>
        <Badge icon={typeIcon} size="sm" color="primary">
          {label}
        </Badge>
        <SheetTitle>{title}</SheetTitle>
        <SheetClose aria-label="Close block settings" />
      </SheetHeader>
      {insertPosition ? (
        <SheetBody>
          <ListFieldTypeCommand
            items={items}
            label={`Insert ${insertPosition}`}
            pasted={pasted}
            pasteLabel={pasted ? pasteBlockLabel(pasted, items) : undefined}
            onPaste={row => insert(insertPosition, cloneRow(row))}
            onSelect={item =>
              insert(insertPosition, createRow(item.id, item.type))
            }
          />
        </SheetBody>
      ) : (
        <>
          <SheetBody>
            {labels && (
              <SheetSection>
                <TextField
                  label="Label"
                  disabled={readOnly}
                  onValueChange={onCustomLabelChange}
                  value={customLabel}
                />
                <div className={styles.ListFieldRowSheet.anchor()}>
                  <div className={styles.ListFieldRowSheet.anchor.field()}>
                    <SlugField
                      fieldValue={anchor}
                      label="Anchor"
                      isDisabled={readOnly}
                      onChange={onAnchorChange}
                      source={customLabel}
                    />
                  </div>
                  {link && (
                    <Tooltip>
                      <TooltipTrigger
                        variant="ghost"
                        size="icon"
                        icon={IcRoundLink}
                        aria-label="Copy link to block"
                        onClick={() => navigator.clipboard.writeText(link)}
                      />
                      <TooltipContent>Copy link to block</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </SheetSection>
            )}
            {tabs}
          </SheetBody>
          <SheetFooter>
            <Button
              variant="ghost"
              size="sm"
              icon={IcRoundFirstPage}
              disabled={readOnly || !canInsert}
              onClick={() => startInsert('before')}
            >
              Insert before
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={IcRoundLastPage}
              disabled={readOnly || !canInsert}
              onClick={() => startInsert('after')}
            >
              Insert after
            </Button>
          </SheetFooter>
          <SheetFooter>
            <Button
              variant="ghost"
              size="sm"
              icon={IcBaselineContentCopy}
              onClick={copy}
            >
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={IcRoundArrowUpward}
              disabled={readOnly || isFirstRow}
              onClick={onMoveUp}
            >
              Move up
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={IcRoundArrowDownward}
              disabled={readOnly || isLastRow}
              onClick={onMoveDown}
            >
              Move down
            </Button>
          </SheetFooter>
          <SheetFooter>
            <Button
              variant="ghost"
              size="sm"
              color="destructive"
              icon={IcRoundDelete}
              disabled={readOnly}
              onClick={onDelete}
            >
              Delete
            </Button>
          </SheetFooter>
        </>
      )}
    </SheetContent>
  )
}

interface ListFieldTypePickerProps {
  className?: string
  isDisabled?: boolean
  items: Array<ListFieldTypeItem>
  label: string
  onOpenChange?: (isOpen: boolean) => void
  pasted?: ListValue
  pasteLabel?: string
  triggerIcon?: ComponentType
  /** Show a button with this text instead of an icon */
  triggerLabel?: string
  onPaste?: (row: ListValue) => void
  onSelect: (item: ListFieldTypeItem) => void
}

function ListFieldTypePicker({
  className,
  isDisabled,
  items,
  label,
  onOpenChange,
  pasted,
  pasteLabel,
  triggerIcon = IcRoundAdd,
  triggerLabel,
  onPaste,
  onSelect
}: ListFieldTypePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      {triggerLabel ? (
        <PopoverTrigger
          className={styles.ListFieldCreateActions.button(
            styler.merge({className})
          )}
          disabled={isDisabled}
          size="sm"
          variant="ghost"
          icon={triggerIcon}
        >
          {triggerLabel}
        </PopoverTrigger>
      ) : (
        <PopoverTrigger
          aria-label={label}
          className={styles.ListFieldTypePicker.trigger(
            styler.merge({className})
          )}
          data-open={isOpen ? 'true' : undefined}
          disabled={isDisabled}
          size="icon"
          icon={triggerIcon}
        />
      )}
      <PopoverContent
        aria-label={label}
        className={styles.ListFieldTypePicker.popover()}
      >
        <ListFieldTypeCommand
          items={items}
          label={label}
          pasted={pasted}
          pasteLabel={pasteLabel}
          onPaste={
            onPaste &&
            (row => {
              onPaste(row)
              handleOpenChange(false)
            })
          }
          onSelect={item => {
            onSelect(item)
            handleOpenChange(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export interface ListFieldTypeCommandProps {
  items: Array<ListFieldTypeItem>
  label: string
  pasted?: ListValue
  pasteLabel?: string
  onPaste?: (row: ListValue) => void
  onSelect: (item: ListFieldTypeItem) => void
}

/** Searchable list of block types, also used to insert rich text blocks */
export function ListFieldTypeCommand({
  items,
  label,
  pasted,
  pasteLabel,
  onPaste,
  onSelect
}: ListFieldTypeCommandProps) {
  const pickerItems = useListFieldPickerItems(
    items,
    pasted,
    pasteLabel,
    onPaste
  )
  return (
    <Command>
      <CommandInput
        aria-label="Search types"
        autoFocus
        placeholder="Search types..."
      />
      <CommandList aria-label={label}>
        <CommandEmpty>No matching types</CommandEmpty>
        {groupItems(pickerItems).map(([group, items]) => {
          const children = items.map(item => (
            <CommandItem
              key={item.id}
              icon={item.icon}
              value={item.id}
              onSelect={() => {
                if (item.pasted) onPaste?.(item.pasted)
                if (item.typeItem) onSelect(item.typeItem)
              }}
            >
              {item.label}
            </CommandItem>
          ))
          if (!group) return children
          return (
            <CommandGroup key={group} heading={group}>
              {children}
            </CommandGroup>
          )
        })}
      </CommandList>
    </Command>
  )
}

/** Items by their group, in the order the groups first appear */
function groupItems(
  items: Array<ListFieldPickerOption>
): Array<[string | undefined, Array<ListFieldPickerOption>]> {
  const groups = new Map<string | undefined, Array<ListFieldPickerOption>>()
  for (const item of items) {
    const group = item.typeItem?.group
    const members = groups.get(group)
    if (members) members.push(item)
    else groups.set(group, [item])
  }
  return [...groups]
}

function useListFieldPickerItems(
  items: Array<ListFieldTypeItem>,
  pasted?: ListValue,
  pasteLabel?: string,
  onPaste?: (row: ListValue) => void
): Array<ListFieldPickerOption> {
  return useMemo<Array<ListFieldPickerOption>>(() => {
    const pasteItem =
      pasted && onPaste
        ? [
            {
              id: 'paste',
              label: pasteLabel || 'Paste block',
              icon: IcBaselineContentPasteGo,
              pasted
            }
          ]
        : []
    return [
      ...pasteItem,
      ...items.map(item => ({
        id: item.id,
        label: item.label,
        icon: getType(item.type).icon || IcRoundAdd,
        typeItem: item
      }))
    ]
  }, [items, onPaste, pasteLabel, pasted])
}
