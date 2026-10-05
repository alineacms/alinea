import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  SortableListItem,
  type DragMoveEvent,
  SortableList,
  SortableListItemTitle,
  SortableListAdd,
  SortableListDragPreview,
  ListError,
  ListLabel,
  SortableListItemActions,
  SortableListItemContent,
  SortableListHandle,
  SortableListItemToggle,
  SortableListItemHeader,
  SortableListItemDescription,
  SortableListItemTrigger,
  Kbd,
  Popover,
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
import {ListField as CoreListField} from '#/core/field/ListField.js'
import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import {ListRow} from '#/core/ListRow.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {slugify} from '#/core/util/Slugs.js'
import {Badge} from '#/components.js'
import {BlockSheet, useBlockSheet} from '#/dashboard/app/BlockSheet.js'
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
  IcRoundAddRowAbove,
  IcRoundAddRowBelow,
  IcRoundLink,
  IcRoundMoreHoriz
} from '#/dashboard/icons.js'
import {ListOptions} from '#/field/list.js'
import {SlugField} from '#/field/path/SlugField.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw, useSetAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import type {ComponentType} from 'react'
import {memo, useCallback, useMemo, useState} from 'react'
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
const LIST_FIELD_ROW_DRAG_TYPE = 'application/x-alinea-list-field-row'

interface ListFieldTypeItem {
  id: string
  label: string
  type: Schema[string]
}

interface ListFieldPickerOption {
  id: string
  label: string
  icon: ComponentType
  typeItem?: ListFieldTypeItem
  pasted?: ListValue
}

export interface ListFieldViewProps {
  field: CoreListField<ListRow, ListValue, ListOptions<Schema>>
}

export function ListFieldView({field}: ListFieldViewProps) {
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
        type
      })),
    [schemaEntries]
  )
  const readOnly = Boolean(options.readOnly)
  const hasRows = nodes.length > 0
  const canCreate = options.max === undefined || nodes.length < options.max
  const [foldedIds, setFoldedIds] = useState<Set<string>>(new Set())
  const rowIdsAtom = useMemo(
    () =>
      atom(get => {
        const nodes = get(list.nodes) as Array<ReactiveNode<ListValue>>
        return nodes.map(node => get(node.field('_id')) as string)
      }),
    [list]
  )
  const rowIds = useAtomValueRaw(rowIdsAtom)
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
  const allExpanded = nodes.length > 0 && foldedIds.size === 0

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

  function addRow(typeName: string, type: Schema[string]) {
    pushRow(createRow(typeName, type))
  }

  const content = (hasRows || !readOnly) && (
    <SortableList
      aria-label={options.label || 'List items'}
      dragType={LIST_FIELD_ROW_DRAG_TYPE}
      onReorder={readOnly ? undefined : moveRow}
    >
      {nodes.map((row, index) => (
        <ListFieldRow
          key={rowIds[index] || index}
          onInsertRow={insertRow}
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
        />
      ))}
      {!readOnly && canCreate && (
        <SortableListAdd>
          <ListFieldCreateActions
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
        inline={options.inline}
      >
        {options.label}
      </ListLabel>
      {content}
      {error && <ListError>{error}</ListError>}
    </>
  )
}

type InsertPosition = 'before' | 'after'

export function insertIndex(
  rowIndex: number,
  position: InsertPosition
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
  items: Array<ListFieldTypeItem>
  pasted?: ListValue
  onPaste: (row: ListValue) => void
  onSelect: (item: ListFieldTypeItem) => void
}

function ListFieldCreateActions({
  items,
  pasted,
  onPaste,
  onSelect
}: ListFieldCreateActionsProps) {
  const visibleItems = items.slice(0, 3)
  const hasMenu = items.length > visibleItems.length
  return (
    <>
      {pasted && (
        <Button
          onClick={() => onPaste(pasted)}
          icon={IcBaselineContentPasteGo}
          variant="outline"
        >
          {pasteBlockLabel(pasted, items)}
        </Button>
      )}
      {visibleItems.map(item => (
        <Button
          key={item.id}
          onClick={() => onSelect(item)}
          icon={getType(item.type).icon ?? IcRoundAdd}
          variant="outline"
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
    </>
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
  onToggleRow: (rowId: string) => void
  onCopyRow: (rowId: string) => void
  onInsertRow: (index: number, row: ListValue) => void
}

interface ListFieldSheetActionProps {
  icon: ComponentType
  label: string
  disabled?: boolean
  onClick: () => void
}

function ListFieldSheetAction({
  icon,
  label,
  disabled,
  onClick
}: ListFieldSheetActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        variant="ghost"
        size="icon-sm"
        icon={icon}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
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
  expanded,
  onToggleRow,
  onCopyRow,
  onInsertRow
}: ListFieldRowProps) {
  const itemId = useAtomValueRaw(row.field('_id')) as string
  const typeName = useAtomValueRaw(row.field('_type')) as string
  const customLabelValue = useAtomValueRaw(row.field('_label')) as
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

  return (
    <>
      <SortableListItem
        aria-label={`${label} item ${index + 1}`}
        current={sheet.open}
        dragPreview={<SortableListDragPreview icon={typeIcon} label={label} />}
        id={itemId}
      >
        <ListFieldRowHeader
          expanded={expanded}
          label={label}
          customLabel={customLabel}
          anchor={anchorValue}
          dragLabel={`Drag ${label} item ${index + 1}`}
          readOnly={readOnly}
          settingsOpen={sheet.open}
          typeIcon={typeIcon}
          onDelete={deleteRow}
          onSettingsToggle={sheet.toggle}
          onToggle={() => onToggleRow(itemId)}
        />
        {expanded && (
          <SortableListItemContent>
            <NodeEditor node={row as ReactiveNode<object>} type={type} />
          </SortableListItemContent>
        )}
      </SortableListItem>
      {/* Outside the item so events in the sheet don't reach its handlers */}
      <BlockSheet id={itemId}>
        <ListFieldRowSheet
          anchor={anchorValue}
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
          onInsertAfter={value =>
            onInsertRow(insertIndex(index, 'after'), value)
          }
          onInsertBefore={value =>
            onInsertRow(insertIndex(index, 'before'), value)
          }
          onMoveDown={() => moveListRow(index, index + 1)}
          onMoveUp={() => moveListRow(index, index - 1)}
        />
      </BlockSheet>
    </>
  )
})

function rowAnchor(customLabel: string, anchor?: string): string {
  return (anchor ?? slugify(customLabel.trim())).trim()
}

interface ListFieldRowHeaderProps {
  expanded: boolean
  label: string
  dragLabel: string
  customLabel: string
  anchor?: string
  readOnly: boolean
  settingsOpen: boolean
  typeIcon?: ComponentType
  onDelete: () => void
  onSettingsToggle: () => void
  onToggle: () => void
}

function ListFieldRowHeader({
  expanded,
  label,
  dragLabel,
  customLabel,
  anchor,
  readOnly,
  settingsOpen,
  typeIcon,
  onDelete,
  onSettingsToggle,
  onToggle
}: ListFieldRowHeaderProps) {
  const displayAnchor = rowAnchor(customLabel, anchor)
  const title = customLabel.trim() || (displayAnchor && `#${displayAnchor}`)
  return (
    <SortableListItemHeader>
      {!readOnly && <SortableListHandle aria-label={dragLabel} />}
      <SortableListItemTitle>
        <SortableListItemToggle
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          expanded={expanded}
          onClick={onToggle}
        />
        <SortableListItemTrigger
          aria-label={`${label} settings`}
          aria-expanded={settingsOpen}
          onClick={onSettingsToggle}
        >
          <Badge icon={typeIcon}>{label}</Badge>
          {title && (
            <SortableListItemDescription>{title}</SortableListItemDescription>
          )}
        </SortableListItemTrigger>
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

interface ListFieldRowSheetProps {
  anchor?: string
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
        <Badge icon={typeIcon} size="sm">
          {label}
        </Badge>
        <SheetTitle>{title}</SheetTitle>
        <Kbd size="sm" aria-hidden>
          Esc
        </Kbd>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={IcRoundLink}
                    aria-label="Copy link to block"
                    onClick={() => navigator.clipboard.writeText(link)}
                  />
                )}
              </div>
            </SheetSection>
          </SheetBody>
          <SheetFooter>
            <Button
              variant="ghost"
              size="sm"
              icon={IcRoundAddRowAbove}
              disabled={readOnly || !canInsert}
              onClick={() => startInsert('before')}
            >
              Insert before
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={IcRoundAddRowBelow}
              disabled={readOnly || !canInsert}
              onClick={() => startInsert('after')}
            >
              Insert after
            </Button>
          </SheetFooter>
          <SheetFooter>
            <ListFieldSheetAction
              icon={IcBaselineContentCopy}
              label="Copy"
              onClick={copy}
            />
            <ListFieldSheetAction
              icon={IcRoundArrowUpward}
              label="Move up"
              disabled={readOnly || isFirstRow}
              onClick={onMoveUp}
            />
            <ListFieldSheetAction
              icon={IcRoundArrowDownward}
              label="Move down"
              disabled={readOnly || isLastRow}
              onClick={onMoveDown}
            />
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
  items: Array<ListFieldTypeItem>
  label: string
  onOpenChange?: (isOpen: boolean) => void
  pasted?: ListValue
  pasteLabel?: string
  triggerIcon?: ComponentType
  onPaste?: (row: ListValue) => void
  onSelect: (item: ListFieldTypeItem) => void
}

function ListFieldTypePicker({
  items,
  label,
  onOpenChange,
  pasted,
  pasteLabel,
  triggerIcon = IcRoundAdd,
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
      <PopoverTrigger
        aria-label={label}
        variant="outline"
        size="icon"
        icon={triggerIcon}
      />
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

interface ListFieldTypeCommandProps {
  items: Array<ListFieldTypeItem>
  label: string
  pasted?: ListValue
  pasteLabel?: string
  onPaste?: (row: ListValue) => void
  onSelect: (item: ListFieldTypeItem) => void
}

function ListFieldTypeCommand({
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
        {pickerItems.map(item => (
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
        ))}
      </CommandList>
    </Command>
  )
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
