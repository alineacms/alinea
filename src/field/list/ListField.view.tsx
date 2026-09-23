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
  SortableListItemSettings,
  Popover,
  PopoverContent,
  PopoverTrigger,
  TextField
} from '#/components.js'
import {ListField as CoreListField} from '#/core/field/ListField.js'
import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import {ListRow} from '#/core/ListRow.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {slugify} from '#/core/util/Slugs.js'
import {Badge} from '#/components.js'
import {NodeEditor} from '#/dashboard/app/EntryFields.js'
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
  IcRoundMoreHoriz
} from '#/dashboard/icons.js'
import {ListOptions} from '#/field/list.js'
import {SlugField} from '#/field/path/SlugField.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw, useSetAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import type {ComponentType} from 'react'
import {createContext, useContext, useMemo, useState} from 'react'
import css from './ListField.module.css'

const styles = styler(css)
const ListFieldDepthContext = createContext(0)

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
  const depth = useContext(ListFieldDepthContext)
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

  function toggleRow(rowId: string) {
    setFoldedIds(current => {
      const next = new Set(current)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  function addRow(typeName: string, type: Schema[string]) {
    pushRow(createRow(typeName, type))
  }

  const content = (hasRows || !readOnly) && (
    <SortableList
      aria-label={options.label || 'List items'}
      data-depth={depth % 2 === 0 ? 'muted' : 'base'}
      dragType={LIST_FIELD_ROW_DRAG_TYPE}
      onReorder={readOnly ? undefined : moveRow}
    >
      {nodes.map((row, index) => (
        <ListFieldRow
          key={rowIds[index] || index}
          addBetweenRow={(value, position = 'after') =>
            insertRow(insertIndex(index, position), value)
          }
          canCreate={canCreate}
          foldedIds={foldedIds}
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
    <ListFieldDepthContext.Provider value={depth + 1}>
      <ListLabel
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
    </ListFieldDepthContext.Provider>
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
  foldedIds: Set<string>
  onToggleRow: (rowId: string) => void
  onCopyRow: (rowId: string) => void
  addBetweenRow: (row: ListValue, position?: 'before' | 'after') => void
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

function ListFieldRow({
  canCreate,
  index,
  list,
  readOnly,
  row,
  rows,
  schema,
  typeItems,
  pasted,
  foldedIds,
  onToggleRow,
  onCopyRow,
  addBetweenRow
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
  const type = schema[typeName]
  if (!type) return null

  const label = Type.label(type)
  const typeIcon = getType(type).icon
  const expanded = !foldedIds.has(itemId)
  function moveCurrentRow(direction: -1 | 1) {
    moveListRow(index, index + direction)
  }

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
    <SortableListItem
      aria-label={`${label} item ${index + 1}`}
      dragPreview={<SortableListDragPreview icon={typeIcon} label={label} />}
      id={itemId}
      role="listitem"
    >
      <ListFieldRowHeader
        canInsert={canCreate}
        expanded={expanded}
        isFirstRow={index === 0}
        isLastRow={index === rows - 1}
        label={label}
        customLabel={customLabel}
        anchor={anchorValue}
        dragLabel={`Drag ${label} item ${index + 1}`}
        readOnly={readOnly}
        typeIcon={typeIcon}
        insertItems={typeItems}
        pasted={pasted && schema[pasted._type] ? pasted : undefined}
        onAnchorChange={updateAnchor}
        onCustomLabelChange={updateCustomLabel}
        onCopy={() => onCopyRow(itemId)}
        onDelete={deleteRow}
        onInsertBefore={(value: ListValue) => addBetweenRow(value, 'before')}
        onInsertAfter={(value: ListValue) => addBetweenRow(value, 'after')}
        onMoveDown={() => moveCurrentRow(1)}
        onMoveUp={() => moveCurrentRow(-1)}
        onToggle={() => onToggleRow(itemId)}
      />
      {expanded && (
        <SortableListItemContent>
          <NodeEditor node={row as ReactiveNode<object>} type={type} />
        </SortableListItemContent>
      )}
    </SortableListItem>
  )
}

interface ListFieldRowHeaderProps {
  className?: string
  canInsert: boolean
  expanded: boolean
  isFirstRow: boolean
  isLastRow: boolean
  isPreview?: boolean
  insertItems: Array<ListFieldTypeItem>
  label: string
  dragLabel: string
  customLabel: string
  anchor?: string
  pasted?: ListValue
  readOnly: boolean
  typeIcon?: ComponentType
  onAnchorChange: (value: string) => void
  onCustomLabelChange: (value: string) => void
  onCopy?: () => void
  onDelete?: () => void
  onInsertBefore: (value: ListValue) => void
  onInsertAfter: (value: ListValue) => void
  onMoveDown?: () => void
  onMoveUp?: () => void
  onToggle?: () => void
}

function ListFieldRowHeader({
  canInsert,
  className,
  expanded,
  isFirstRow,
  isLastRow,
  isPreview,
  insertItems,
  label,
  dragLabel,
  customLabel,
  anchor,
  pasted,
  readOnly,
  typeIcon,
  onAnchorChange,
  onCustomLabelChange,
  onCopy,
  onDelete,
  onInsertBefore,
  onInsertAfter,
  onMoveDown,
  onMoveUp,
  onToggle
}: ListFieldRowHeaderProps) {
  const displayLabel = customLabel.trim()
  const displayAnchor = (anchor ?? slugify(displayLabel)).trim()
  const showAnchor = Boolean(displayAnchor && !displayLabel)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [insertPosition, setInsertPosition] = useState<
    'before' | 'after' | null
  >(null)

  function closeActions() {
    setActionsOpen(false)
    setInsertPosition(null)
  }

  return (
    <SortableListItemHeader className={className}>
      {!readOnly && <SortableListHandle aria-label={dragLabel} />}
      <SortableListItemTitle>
        <SortableListItemToggle
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          expanded={expanded}
          disabled={isPreview}
          onClick={onToggle}
        />
        <Badge icon={typeIcon} size="sm">
          {label}
        </Badge>
        {displayLabel && (
          <SortableListItemDescription>
            {displayLabel}
          </SortableListItemDescription>
        )}
        {showAnchor && <Badge size="sm">#{displayAnchor}</Badge>}
      </SortableListItemTitle>
      <SortableListItemActions>
        <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
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
                onPaste={row => {
                  if (insertPosition === 'before') onInsertBefore(cloneRow(row))
                  else onInsertAfter(cloneRow(row))
                  closeActions()
                }}
                onSelect={item => {
                  const row = createRow(item.id, item.type)
                  if (insertPosition === 'before') onInsertBefore(row)
                  else onInsertAfter(row)
                  closeActions()
                }}
              />
            ) : (
              <>
                <SortableListItemSettings>
                  <TextField
                    label="Label"
                    autoFocus
                    disabled={readOnly || isPreview}
                    onValueChange={onCustomLabelChange}
                    value={customLabel}
                  />
                  <SlugField
                    fieldValue={anchor}
                    label="Anchor"
                    isDisabled={readOnly || isPreview}
                    onChange={onAnchorChange}
                    source={customLabel}
                  />
                </SortableListItemSettings>
                <hr className={styles.ListFieldRowHeader.separator()} />
                <SortableListItemSettings variant="actions">
                  <Button
                    variant="ghost"
                    icon={IcBaselineContentCopy}
                    onClick={() => {
                      onCopy?.()
                      closeActions()
                    }}
                  >
                    Copy
                  </Button>
                </SortableListItemSettings>
                <hr className={styles.ListFieldRowHeader.separator()} />
                <SortableListItemSettings variant="actions">
                  {!isFirstRow && (
                    <Button
                      variant="ghost"
                      icon={IcRoundArrowUpward}
                      onClick={() => {
                        onMoveUp?.()
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
                        onMoveDown?.()
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
                        isDisabled={Boolean(readOnly || isPreview)}
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
                        isDisabled={Boolean(readOnly || isPreview)}
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
              </>
            )}
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          aria-label={`Remove ${label}`}
          icon={IcRoundClose}
          disabled={readOnly || isPreview}
          onClick={onDelete}
          size="icon-sm"
        />
      </SortableListItemActions>
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
