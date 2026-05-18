import {
  Button,
  Dialog,
  DialogTrigger,
  Icon,
  Label,
  Popover,
  SearchField
} from '#/components.js'
import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {ListField as CoreListField} from '#/core/field/ListField.js'
import {ListRow} from '#/core/shape/ListShape.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {
  Surface,
  SurfaceContent,
  SurfaceHeader
} from '#/dashboard/app/ui/Surface.js'
import {
  IcBaselineContentCopy,
  IcBaselineContentPasteGo,
  IcRoundAdd,
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundClose,
  IcRoundKeyboardArrowRight,
  IcRoundMoreVert
} from '#/dashboard/icons.js'
import {ReactiveNode} from '#/dashboard/store/Dashboard.js'
import {
  useFieldError,
  useFieldNode,
  useFieldOptions,
  useNodes
} from '#/dashboard/store/hooks.js'
import {ListOptions} from '#/field/list.js'
import styler from '@alinea/styler'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import type {ComponentType} from 'react'
import {useContext, useMemo, useRef, useState} from 'react'
import {
  type DragItem,
  DragPreview,
  type DragPreviewRenderer,
  type DropItem,
  useDrag,
  useDrop,
  useFilter
} from 'react-aria'
import {
  Autocomplete,
  ListBox,
  ListBoxItem,
  OverlayTriggerStateContext
} from 'react-aria-components'
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
  const pasted = useAtomValue(copyAtom)
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
  const [foldedIds, setFoldedIds] = useState<Set<string>>(new Set())
  const rowIdsAtom = useMemo(
    () =>
      atom(get => {
        const nodes = get(list.nodes) as Array<ReactiveNode<ListValue>>
        return nodes.map(node => get(node.field('_id')) as string)
      }),
    [list]
  )
  const rowIds = useAtomValue(rowIdsAtom)
  const moveRowAtom = useMemo(
    () =>
      atom(null, (get, set, rowId: string, targetIndex: number) => {
        const nodes = get(list.nodes) as Array<ReactiveNode<ListValue>>
        const fromIndex = nodes.findIndex(node => {
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
  const copyRowAtom = useMemo(
    () =>
      atom(null, (get, set, rowId: string) => {
        const copied = get(copyAtom)
        if (copied?._id === rowId) {
          set(copyAtom, undefined)
          return
        }
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

  const foldAll = (
    <Button
      aria-label={
        hasRows
          ? allExpanded
            ? 'Collapse all items'
            : 'Expand all items'
          : 'No list items to fold'
      }
      appearance="plain"
      className={styles.ListFieldView.fold()}
      data-expanded={allExpanded ? 'true' : undefined}
      isDisabled={!hasRows}
      onPress={toggleAll}
    >
      <Icon aria-hidden icon={IcRoundKeyboardArrowRight} />
    </Button>
  )

  const content = (hasRows || !readOnly) && (
    <Surface className={styles.ListFieldView.surface()}>
      {hasRows && (
        <div
          aria-label={options.label || 'List items'}
          className={styles.ListFieldView.rows()}
          role="list"
        >
          {nodes.map((row, index) => (
            <ListFieldRow
              key={rowIds[index] || index}
              addBetweenRow={(value, position = 'after') =>
                insertRow(insertIndex(index, position), value)
              }
              copiedRowId={pasted?._id}
              foldedIds={foldedIds}
              index={index}
              list={list}
              readOnly={readOnly}
              onCopyRow={copyRow}
              onMoveRow={moveRow}
              onToggleRow={toggleRow}
              row={row}
              rows={nodes.length}
              schema={options.schema}
              pasted={pasted}
              typeItems={typeItems}
            />
          ))}
        </div>
      )}
      {!readOnly && (
        <SurfaceContent className={styles.ListFieldView.createRow()}>
          <ListFieldCreateActions
            items={typeItems}
            pasted={pasted && options.schema[pasted._type] ? pasted : undefined}
            onPaste={row => pushRow(cloneRow(row))}
            onSelect={item => addRow(item.id, item.type)}
          />
        </SurfaceContent>
      )}
    </Surface>
  )

  return (
    <Label errorMessage={error} icon={foldAll} label={options.label}>
      <div className={styles.ListFieldView()}>{content}</div>
    </Label>
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
  return item ? `Paste ${item.label} block` : 'Paste block'
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
    <div className={styles.ListFieldView.create()}>
      {pasted && (
        <Button
          appearance="outline"
          className={styles.ListFieldView.createButton()}
          onPress={() => onPaste(pasted)}
          size="small"
        >
          <Icon aria-hidden icon={IcBaselineContentPasteGo} />
          {pasteBlockLabel(pasted, items)}
        </Button>
      )}
      {visibleItems.map(item => (
        <Button
          appearance="outline"
          className={styles.ListFieldView.createButton()}
          key={item.id}
          onPress={() => onSelect(item)}
          size="small"
        >
          <Icon aria-hidden icon={getType(item.type).icon || IcRoundAdd} />
          {item.label}
        </Button>
      ))}
      {hasMenu && (
        <ListFieldTypePicker
          items={items}
          label="More block types"
          pasted={pasted}
          pasteLabel={pasted ? pasteBlockLabel(pasted, items) : undefined}
          triggerIcon={IcRoundMoreVert}
          onPaste={onPaste}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}

interface ListFieldRowProps {
  index: number
  list: ReactiveNode<Array<ListValue>>
  readOnly: boolean
  row: ReactiveNode<ListValue>
  rows: number
  schema: Schema
  typeItems: Array<ListFieldTypeItem>
  pasted?: ListValue
  foldedIds: Set<string>
  copiedRowId?: string
  onToggleRow: (rowId: string) => void
  onCopyRow: (rowId: string) => void
  onMoveRow: (rowId: string, targetIndex: number) => void
  addBetweenRow: (row: ListValue, position?: 'before' | 'after') => void
}

interface ListFieldSeparatorProps {
  isTop?: boolean
  label: string
  position: 'before' | 'after'
  readOnly: boolean
  items: Array<ListFieldTypeItem>
  pasted?: ListValue
  showPicker?: boolean
  onPaste: (row: ListValue, position: 'before' | 'after') => void
  onSelect: (item: ListFieldTypeItem, position: 'before' | 'after') => void
  onMoveRow?: (rowId: string, targetIndex: number) => void
  targetIndex?: number
}

function ListFieldSeparator({
  isTop,
  label,
  position,
  readOnly,
  items,
  pasted,
  showPicker = true,
  onPaste,
  onSelect,
  onMoveRow,
  targetIndex
}: ListFieldSeparatorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const separatorRef = useRef<HTMLDivElement>(null)
  const {dropProps, isDropTarget} = useDrop({
    ref: separatorRef,
    isDisabled:
      readOnly || onMoveRow === undefined || targetIndex === undefined,
    getDropOperation(types, allowedOperations) {
      if (!types.has(LIST_FIELD_ROW_DRAG_TYPE)) return 'cancel'
      return allowedOperations.includes('move') ? 'move' : 'cancel'
    },
    async onDrop(event) {
      const rowId = await getDraggedRowId(event.items)
      if (!rowId || targetIndex === undefined || !onMoveRow) return
      onMoveRow(rowId, targetIndex)
    }
  })
  return (
    <div
      {...dropProps}
      aria-label={`Move block ${position} ${label}`}
      className={styles.ListFieldRow.separator()}
      data-drop-target={isDropTarget || undefined}
      data-picker-open={isPickerOpen || undefined}
      data-top={isTop || undefined}
      ref={separatorRef}
    >
      {showPicker && (
        <ListFieldTypePicker
          className={styles.ListFieldRow.separatorPicker()}
          isDisabled={readOnly}
          items={items}
          label={`Add ${label} ${position}`}
          onOpenChange={setIsPickerOpen}
          pasted={pasted}
          pasteLabel={pasted ? pasteBlockLabel(pasted, items) : undefined}
          onPaste={row => onPaste(row, position)}
          onSelect={item => onSelect(item, position)}
        />
      )}
    </div>
  )
}

function ListFieldRow({
  index,
  list,
  readOnly,
  row,
  rows,
  schema,
  typeItems,
  pasted,
  foldedIds,
  copiedRowId,
  onToggleRow,
  onCopyRow,
  onMoveRow,
  addBetweenRow
}: ListFieldRowProps) {
  const itemId = useAtomValue(row.field('_id')) as string
  const typeName = useAtomValue(row.field('_type')) as string
  const moveListRow = useSetAtom(list.move)
  const removeRow = useSetAtom(list.remove)
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
  const type = schema[typeName]
  if (!type) return null

  const label = Type.label(type)
  const typeIcon = getType(type).icon || IcRoundAdd
  const expanded = !foldedIds.has(itemId)
  const isCopied = copiedRowId === itemId

  function moveCurrentRow(direction: -1 | 1) {
    moveListRow(index, index + direction)
  }

  function deleteRow() {
    removeRow(index)
  }

  return (
    <section
      aria-label={`${label} item ${index + 1}`}
      className={styles.ListFieldRow()}
      data-dragging={isDragging || undefined}
      role="listitem"
    >
      {index === 0 && (
        <ListFieldSeparator
          isTop
          items={typeItems}
          label={label}
          pasted={pasted && schema[pasted._type] ? pasted : undefined}
          onMoveRow={onMoveRow}
          onPaste={(row, position) => addBetweenRow(cloneRow(row), position)}
          onSelect={(item, position) =>
            addBetweenRow(createRow(item.id, item.type), position)
          }
          position="before"
          readOnly={readOnly}
          targetIndex={insertIndex(index, 'before')}
        />
      )}
      <SurfaceHeader
        className={styles.ListFieldRow.header()}
        data-expanded={expanded ? 'true' : undefined}
        data-first-row={index === 0 ? 'true' : undefined}
      >
        <DragPreview ref={dragPreview}>
          {() => <ListFieldDragPreview icon={typeIcon} label={label} />}
        </DragPreview>
        <ListFieldRowHeader
          dragProps={dragProps}
          dragLabel={`Drag ${label} item ${index + 1}`}
          expanded={expanded}
          isCopied={isCopied}
          isDragging={isDragging}
          isFirstRow={index === 0}
          isLastRow={index === rows - 1}
          label={label}
          readOnly={readOnly}
          onCopy={() => onCopyRow(itemId)}
          onDelete={deleteRow}
          onMoveDown={() => moveCurrentRow(1)}
          onMoveUp={() => moveCurrentRow(-1)}
          onToggle={() => onToggleRow(itemId)}
        />
      </SurfaceHeader>
      {expanded && (
        <SurfaceContent className={styles.ListFieldRow.body()}>
          <NodeEditor node={row as ReactiveNode<object>} type={type} />
        </SurfaceContent>
      )}
      <ListFieldSeparator
        items={typeItems}
        label={label}
        pasted={pasted && schema[pasted._type] ? pasted : undefined}
        showPicker={index < rows - 1}
        onMoveRow={onMoveRow}
        onPaste={(row, position) => addBetweenRow(cloneRow(row), position)}
        onSelect={(item, position) =>
          addBetweenRow(createRow(item.id, item.type), position)
        }
        position="after"
        readOnly={readOnly}
        targetIndex={insertIndex(index, 'after')}
      />
    </section>
  )
}

interface ListFieldDragPreviewProps {
  icon: ComponentType
  label: string
}

function ListFieldDragPreview({icon, label}: ListFieldDragPreviewProps) {
  return (
    <div className={styles.ListFieldView.dragPreview()}>
      <div className={styles.ListFieldView.dragPreviewIcon()}>
        <Icon aria-hidden icon={icon} />
      </div>
      <div className={styles.ListFieldView.dragPreviewBody()}>
        <strong className={styles.ListFieldView.dragPreviewTitle()}>
          {label}
        </strong>
      </div>
    </div>
  )
}

interface ListFieldRowHeaderProps {
  dragProps?: ReturnType<typeof useDrag>['dragProps']
  dragLabel?: string
  expanded: boolean
  isCopied: boolean
  isDragging: boolean
  isFirstRow: boolean
  isLastRow: boolean
  isPreview?: boolean
  label: string
  readOnly: boolean
  onCopy?: () => void
  onDelete?: () => void
  onMoveDown?: () => void
  onMoveUp?: () => void
  onToggle?: () => void
}

function ListFieldRowHeader({
  dragProps,
  dragLabel,
  expanded,
  isCopied,
  isDragging,
  isFirstRow,
  isLastRow,
  isPreview,
  label,
  readOnly,
  onCopy,
  onDelete,
  onMoveDown,
  onMoveUp,
  onToggle
}: ListFieldRowHeaderProps) {
  return (
    <>
      <div
        {...dragProps}
        aria-label={isPreview ? undefined : dragLabel}
        className={styles.ListFieldRow.drag()}
        data-dragging={isDragging || undefined}
      >
        <Button
          appearance="plain"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          className={styles.ListFieldRow.fold()}
          intent="secondary"
          isDisabled={isPreview}
          onPress={onToggle}
        >
          <Icon aria-hidden icon={IcRoundKeyboardArrowRight} />
        </Button>
        <div className={styles.ListFieldRow.leading()}>
          <strong className={styles.ListFieldRow.title()}>{label}</strong>
        </div>
      </div>
      <div className={styles.ListFieldRow.actions()}>
        <Button
          aria-label={isCopied ? `${label} is copied` : `Copy ${label}`}
          appearance={isCopied ? 'active' : 'outline'}
          isDisabled={readOnly || isPreview}
          intent="secondary"
          onPress={onCopy}
          size="icon"
        >
          <Icon aria-hidden data-slot="icon" icon={IcBaselineContentCopy} />
        </Button>
        <Button
          aria-label={`Move ${label} up`}
          appearance="outline"
          isDisabled={readOnly || isPreview || isFirstRow}
          intent="secondary"
          onPress={onMoveUp}
          size="icon"
        >
          <Icon aria-hidden icon={IcRoundArrowUpward} />
        </Button>
        <Button
          aria-label={`Move ${label} down`}
          appearance="outline"
          isDisabled={readOnly || isPreview || isLastRow}
          intent="secondary"
          onPress={onMoveDown}
          size="icon"
        >
          <Icon aria-hidden icon={IcRoundArrowDownward} />
        </Button>
        <Button
          aria-label={`Remove ${label}`}
          appearance="outline"
          isDisabled={readOnly || isPreview}
          intent="danger"
          onPress={onDelete}
          size="icon"
        >
          <Icon aria-hidden icon={IcRoundClose} />
        </Button>
      </div>
    </>
  )
}

function dragRowItem(id: string): DragItem {
  return {
    'text/plain': id,
    [LIST_FIELD_ROW_DRAG_TYPE]: id
  }
}

async function getDraggedRowId(items: Array<DropItem>): Promise<string | null> {
  for (const item of items) {
    if (
      item.kind === 'text' &&
      item.types.has(LIST_FIELD_ROW_DRAG_TYPE) &&
      item.getText
    ) {
      return item.getText(LIST_FIELD_ROW_DRAG_TYPE)
    }
  }
  return null
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
  const {contains} = useFilter({sensitivity: 'base'})
  const pickerItems = useMemo<Array<ListFieldPickerOption>>(() => {
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

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)
    onOpenChange?.(nextOpen)
    if (nextOpen) return
    globalThis.setTimeout(() => {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement) activeElement.blur()
    }, 0)
  }

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button
        aria-label={label}
        className={styles.ListFieldTypePicker.trigger(
          styler.merge({className})
        )}
        data-open={isOpen ? 'true' : undefined}
        isDisabled={isDisabled}
        intent="primary"
        size="icon"
      >
        <Icon aria-hidden icon={triggerIcon} />
      </Button>
      <Popover className={styles.ListFieldTypePicker.popover()}>
        <Dialog className={styles.ListFieldTypePicker.dialog()}>
          <Autocomplete filter={contains}>
            <SearchField
              aria-label="Search types"
              autoFocus
              className={styles.ListFieldTypePicker.search()}
              hasIcon
              placeholder="Search types..."
            />
            <ListBox
              aria-label={label}
              className={styles.ListFieldTypePicker.list()}
              items={pickerItems}
              renderEmptyState={() => (
                <div className={styles.ListFieldTypePicker.empty()}>
                  No matching types
                </div>
              )}
            >
              {item => (
                <ListFieldTypePickerAction
                  key={item.id}
                  item={item}
                  onPaste={onPaste}
                  onSelect={onSelect}
                />
              )}
            </ListBox>
          </Autocomplete>
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}

interface ListFieldTypePickerActionProps {
  item: ListFieldPickerOption
  onPaste?: (row: ListValue) => void
  onSelect: (item: ListFieldTypeItem) => void
}

function ListFieldTypePickerAction({
  item,
  onPaste,
  onSelect
}: ListFieldTypePickerActionProps) {
  const overlay = useContext(OverlayTriggerStateContext)
  return (
    <ListBoxItem
      className={styles.ListFieldTypePicker.item()}
      id={item.id}
      onAction={() => {
        if (item.pasted) onPaste?.(item.pasted)
        if (item.typeItem) onSelect(item.typeItem)
        overlay?.close()
      }}
      textValue={item.label}
    >
      <Icon aria-hidden icon={item.icon} />
      <span>{item.label}</span>
    </ListBoxItem>
  )
}
