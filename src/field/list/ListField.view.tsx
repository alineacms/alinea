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
  SortableListItemDisclosure,
  SortableListItemIcon,
  SortableListItemInsert,
  SortableListItemLabel,
  SortableListItemSettings,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  TextField as TextInput
} from '#/components.js'
import {ListField as CoreListField} from '#/core/field/ListField.js'
import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import {ListRow} from '#/core/ListRow.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {slugify} from '#/core/util/Slugs.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
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
  IcRoundFirstPage,
  IcRoundLastPage,
  IcRoundMoreHoriz,
  IcOutlineViewList
} from '#/dashboard/icons.js'
import {ListOptions} from '#/field/list.js'
import {SlugField} from '#/field/path/SlugField.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw, useSetAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import type {ComponentType} from 'react'
import {memo, useCallback, useMemo, useRef, useState} from 'react'
import css from './ListField.module.css'
import {rowSummary} from './RowSummary.js'

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
  name?: string
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
        count={nodes.length}
        expanded={allExpanded}
        hasRows={hasRows}
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

function typeIcon(type: Schema[string]): ComponentType {
  return getType(type).icon || IcOutlineViewList
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
          variant="ghost"
        >
          <SortableListItemIcon
            icon={typeIcon(item.type)}
            name={item.label}
            size="sm"
          />
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
  onToggleRow: (rowId: string) => void
  onCopyRow: (rowId: string) => void
  onInsertRow: (index: number, row: ListValue) => void
}

interface ListFieldInsertActionProps {
  icon: ComponentType
  isDisabled: boolean
  items: Array<ListFieldTypeItem>
  label: string
  pasted?: ListValue
  onClose: () => void
  onOpenPicker: () => void
  onSelect: (item: ListFieldTypeItem) => void
}

function ListFieldInsertAction({
  icon,
  isDisabled,
  items,
  label,
  pasted,
  onClose,
  onOpenPicker,
  onSelect
}: ListFieldInsertActionProps) {
  const directAddItem = !pasted && items.length === 1 ? items[0] : undefined
  if (directAddItem) {
    return (
      <Button
        variant="ghost"
        className={styles.ListFieldView.insertAction()}
        icon={icon}
        disabled={isDisabled}
        onClick={() => {
          onSelect(directAddItem)
          onClose()
        }}
      >
        {label}
      </Button>
    )
  }
  return (
    <Button
      variant="ghost"
      className={styles.ListFieldView.insertAction()}
      disabled={isDisabled}
      onClick={() => {
        onOpenPicker()
      }}
      icon={icon}
    >
      {label}
    </Button>
  )
}

interface ListFieldInsertPanelProps {
  items: Array<ListFieldTypeItem>
  label: string
  pasted?: ListValue
  pasteLabel?: string
  onPaste: (row: ListValue) => void
  onSelect: (item: ListFieldTypeItem) => void
}

function ListFieldInsertPanel({
  items,
  label,
  pasted,
  pasteLabel,
  onPaste,
  onSelect
}: ListFieldInsertPanelProps) {
  return (
    <ListFieldTypeCommand
      items={items}
      label={label}
      pasted={pasted}
      pasteLabel={pasteLabel}
      onPaste={onPaste}
      onSelect={onSelect}
    />
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
  const customLabel =
    (useAtomValueRaw(row.field('_label')) as string | undefined) ?? ''
  const anchor = useAtomValueRaw(row.field('_anchor')) as string | undefined
  const moveListRow = useSetAtom(list.move)
  const removeRow = useSetAtom(list.remove)
  const type = schema[typeName] as Type | undefined
  const summaryAtom = useMemo(
    () => atom(get => (type ? rowSummary(type, get(row.value)) : '')),
    [row, type]
  )
  const summary = useAtomValueRaw(summaryAtom)
  if (!type) return null

  const label = Type.label(type)
  const icon = typeIcon(type)
  const displayLabel = customLabel.trim()
  const title = displayLabel || summary || label
  const description = displayLabel ? summary : summary && label

  return (
    <SortableListItem
      aria-label={`${label} item ${index + 1}`}
      dragPreview={<SortableListDragPreview icon={icon} label={label} />}
      id={itemId}
    >
      {index > 0 && canCreate && !readOnly && (
        <ListFieldInsertGap
          items={typeItems}
          label={`Insert before ${label} item ${index + 1}`}
          pasted={pasted && schema[pasted._type] ? pasted : undefined}
          onInsert={value => onInsertRow(insertIndex(index, 'before'), value)}
        />
      )}
      <ListFieldRowHeader
        canInsert={canCreate}
        expanded={expanded}
        isFirstRow={index === 0}
        isLastRow={index === rows - 1}
        label={label}
        title={title}
        description={description}
        dragLabel={`Drag ${label} item ${index + 1}`}
        readOnly={readOnly}
        typeIcon={icon}
        insertItems={typeItems}
        pasted={pasted && schema[pasted._type] ? pasted : undefined}
        onCopy={() => onCopyRow(itemId)}
        onDelete={() => removeRow(index)}
        onInsertBefore={(value: ListValue) =>
          onInsertRow(insertIndex(index, 'before'), value)
        }
        onInsertAfter={(value: ListValue) =>
          onInsertRow(insertIndex(index, 'after'), value)
        }
        onMoveDown={() => moveListRow(index, index + 1)}
        onMoveUp={() => moveListRow(index, index - 1)}
        onToggle={() => onToggleRow(itemId)}
      />
      {expanded && (
        <SortableListItemContent>
          <NodeEditor node={row as ReactiveNode<object>} type={type} />
          <ListFieldRowSettings
            anchor={anchor}
            customLabel={customLabel}
            readOnly={readOnly}
            row={row}
          />
        </SortableListItemContent>
      )}
    </SortableListItem>
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

interface ListFieldRowSettingsProps {
  anchor?: string
  customLabel: string
  readOnly: boolean
  row: ReactiveNode<ListValue>
}

function ListFieldRowSettings({
  anchor,
  customLabel,
  readOnly,
  row
}: ListFieldRowSettingsProps) {
  const setCustomLabel = useSetAtom(row.field('_label'))
  const setAnchor = useSetAtom(row.field('_anchor'))
  const summary = [customLabel.trim(), anchor && `#${anchor}`]
    .filter(Boolean)
    .join(' · ')

  function updateCustomLabel(nextValue: string) {
    setCustomLabel(nextValue || undefined)
    const syncAnchor = anchor === undefined || anchor === slugify(customLabel)
    if (syncAnchor) setAnchor(slugify(nextValue) || undefined)
  }

  function updateAnchor(nextValue: string) {
    setAnchor(slugify(nextValue.replace(/^#+/, '')) || undefined)
  }

  return (
    <SortableListItemDisclosure summary={summary}>
      <TextInput
        label="Label"
        disabled={readOnly}
        onValueChange={updateCustomLabel}
        value={customLabel}
      />
      <SlugField
        fieldValue={anchor}
        label="Anchor"
        isDisabled={readOnly}
        onChange={updateAnchor}
        source={customLabel}
      />
    </SortableListItemDisclosure>
  )
}

interface ListFieldRowHeaderProps {
  canInsert: boolean
  expanded: boolean
  isFirstRow: boolean
  isLastRow: boolean
  insertItems: Array<ListFieldTypeItem>
  label: string
  title: string
  description?: string
  dragLabel: string
  pasted?: ListValue
  readOnly: boolean
  typeIcon: ComponentType
  onCopy: () => void
  onDelete: () => void
  onInsertBefore: (value: ListValue) => void
  onInsertAfter: (value: ListValue) => void
  onMoveDown: () => void
  onMoveUp: () => void
  onToggle: () => void
}

function ListFieldRowHeader({
  canInsert,
  expanded,
  isFirstRow,
  isLastRow,
  insertItems,
  label,
  title,
  description,
  dragLabel,
  pasted,
  readOnly,
  typeIcon,
  onCopy,
  onDelete,
  onInsertBefore,
  onInsertAfter,
  onMoveDown,
  onMoveUp,
  onToggle
}: ListFieldRowHeaderProps) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const [insertPosition, setInsertPosition] = useState<
    'before' | 'after' | null
  >(null)

  function closeActions() {
    setActionsOpen(false)
    setInsertPosition(null)
  }

  function insert(row: ListValue) {
    if (insertPosition === 'before') onInsertBefore(row)
    else onInsertAfter(row)
    closeActions()
  }

  return (
    <SortableListItemHeader>
      {!readOnly && <SortableListHandle aria-label={dragLabel} />}
      <SortableListItemTitle>
        <SortableListItemToggle
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          expanded={expanded}
          onClick={onToggle}
        />
        <SortableListItemIcon icon={typeIcon} name={label} />
        <SortableListItemLabel>{title}</SortableListItemLabel>
        {description && (
          <SortableListItemDescription>
            {description}
          </SortableListItemDescription>
        )}
      </SortableListItemTitle>
      {!readOnly && (
        <SortableListItemActions>
          <Popover
            open={actionsOpen}
            onOpenChange={open => {
              if (open) setActionsOpen(true)
              else closeActions()
            }}
          >
            <PopoverTrigger
              variant="ghost"
              aria-label={`${label} actions`}
              icon={IcRoundMoreHoriz}
              size="icon-sm"
            />
            <PopoverContent
              aria-label={`${label} actions`}
              side="bottom"
              align="end"
            >
              {insertPosition ? (
                <ListFieldInsertPanel
                  items={insertItems}
                  label={`Insert ${insertPosition}`}
                  pasted={pasted}
                  pasteLabel={
                    pasted ? pasteBlockLabel(pasted, insertItems) : undefined
                  }
                  onPaste={row => insert(cloneRow(row))}
                  onSelect={item => insert(createRow(item.id, item.type))}
                />
              ) : (
                <SortableListItemSettings variant="actions">
                  <Button
                    variant="ghost"
                    icon={IcBaselineContentCopy}
                    onClick={() => {
                      onCopy()
                      closeActions()
                    }}
                  >
                    Copy
                  </Button>
                  {!isFirstRow && (
                    <Button
                      variant="ghost"
                      icon={IcRoundArrowUpward}
                      onClick={() => {
                        onMoveUp()
                        closeActions()
                      }}
                    >
                      Move up
                    </Button>
                  )}
                  {!isLastRow && (
                    <Button
                      variant="ghost"
                      icon={IcRoundArrowDownward}
                      onClick={() => {
                        onMoveDown()
                        closeActions()
                      }}
                    >
                      Move down
                    </Button>
                  )}
                  {canInsert && (
                    <>
                      <ListFieldInsertAction
                        icon={IcRoundFirstPage}
                        isDisabled={false}
                        items={insertItems}
                        label="Insert before"
                        pasted={pasted}
                        onClose={closeActions}
                        onOpenPicker={() => setInsertPosition('before')}
                        onSelect={item =>
                          onInsertBefore(createRow(item.id, item.type))
                        }
                      />
                      <ListFieldInsertAction
                        icon={IcRoundLastPage}
                        isDisabled={false}
                        items={insertItems}
                        label="Insert after"
                        pasted={pasted}
                        onClose={closeActions}
                        onOpenPicker={() => setInsertPosition('after')}
                        onSelect={item =>
                          onInsertAfter(createRow(item.id, item.type))
                        }
                      />
                    </>
                  )}
                </SortableListItemSettings>
              )}
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            aria-label={`Remove ${label}`}
            icon={IcRoundClose}
            onClick={onDelete}
            size="icon-sm"
          />
        </SortableListItemActions>
      )}
    </SortableListItemHeader>
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
        className={styles.ListFieldTypePicker.trigger(
          styler.merge({className})
        )}
        data-open={isOpen ? 'true' : undefined}
        disabled={isDisabled}
        size="sm"
        variant="ghost"
        icon={triggerIcon}
      >
        More
      </PopoverTrigger>
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
            icon={
              <SortableListItemIcon
                icon={item.icon}
                name={item.name}
                size="sm"
              />
            }
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
        icon: typeIcon(item.type),
        name: item.label,
        typeItem: item
      }))
    ]
  }, [items, onPaste, pasteLabel, pasted])
}
