import {
  Button,
  Dialog,
  DialogTrigger,
  FoldIcon,
  Icon,
  MenuSeparator,
  Popover,
  SearchField,
  SharedLabelBadge,
  TextField
} from '#/components.js'
import {ListField as CoreListField} from '#/core/field/ListField.js'
import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import {ListRow} from '#/core/ListRow.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {CompactRecordFields} from '#/dashboard/app/CompactField.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {InsertionSeparator} from '#/dashboard/app/ui/InsertionSeparator.js'
import {Surface, SurfaceHeader} from '#/dashboard/app/ui/Surface.js'
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
import {ReactiveNode} from '#/dashboard/store/Dashboard.js'
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
  useDrag,
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

  const content = (hasRows || !readOnly) && (
    <>
      {hasRows && !readOnly && (
        <ListFieldSeparator
          items={typeItems}
          label="first block"
          pasted={pasted && options.schema[pasted._type] ? pasted : undefined}
          onMoveRow={moveRow}
          onPaste={row => insertRow(0, cloneRow(row))}
          onSelect={item => insertRow(0, createRow(item.id, item.type))}
          placement="edge"
          position="before"
          readOnly={readOnly}
          targetIndex={0}
        />
      )}
      <Surface
        aria-label={options.label || 'List items'}
        className={styles.ListFieldView()}
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

        {!readOnly && (
          <div
            className={styles.ListFieldView.create()}
            data-empty={!hasRows || undefined}
          >
            <SurfaceHeader className={styles.ListFieldView.createRow()}>
              <ListFieldCreateActions
                items={typeItems}
                pasted={
                  pasted && options.schema[pasted._type] ? pasted : undefined
                }
                onPaste={row => pushRow(cloneRow(row))}
                onSelect={item => addRow(item.id, item.type)}
              />
            </SurfaceHeader>
          </div>
        )}
      </Surface>
    </>
  )

  return (
    <>
      <Button
        aria-label={
          hasRows
            ? allExpanded
              ? 'Collapse all items'
              : 'Expand all items'
            : 'No list items to fold'
        }
        appearance="plain"
        className={styles.ListFieldView.label()}
        data-has-rows={hasRows ? 'true' : undefined}
        isDisabled={!hasRows}
        onPress={toggleAll}
      >
        {options.label}
        {options.shared && <SharedLabelBadge />}
        <FoldIcon aria-hidden data-slot="icon" expanded={allExpanded} />
      </Button>
      {content}
      {error && <div className={styles.ListFieldView.error()}>{error}</div>}
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
    <div className={styles.ListFieldCreateActions()}>
      {pasted && (
        <Button
          className={styles.ListFieldCreateActions.button()}
          onPress={() => onPaste(pasted)}
          size="small"
          icon={IcBaselineContentPasteGo}
          appearance="plain"
        >
          {pasteBlockLabel(pasted, items)}
        </Button>
      )}
      {visibleItems.map(item => (
        <Button
          className={styles.ListFieldCreateActions.button()}
          key={item.id}
          onPress={() => onSelect(item)}
          size="small"
          icon={getType(item.type).icon || IcRoundAdd}
          appearance="plain"
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
  label: string
  placement?: 'between' | 'edge'
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
  label,
  placement = 'between',
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
  const directAddItem =
    showPicker && !pasted && items.length === 1 ? items[0] : undefined
  return (
    <InsertionSeparator
      controlOpen={isPickerOpen}
      dragType={LIST_FIELD_ROW_DRAG_TYPE}
      label={label}
      onMoveRow={onMoveRow}
      placement={placement}
      position={position}
      readOnly={readOnly}
      targetIndex={targetIndex}
    >
      {directAddItem && (
        <Button
          aria-label={`Add ${directAddItem.label} ${position}`}
          icon={getType(directAddItem.type).icon || IcRoundAdd}
          isDisabled={readOnly}
          onPress={() => onSelect(directAddItem, position)}
          size="icon"
        />
      )}
      {showPicker && !directAddItem && (
        <ListFieldTypePicker
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
    </InsertionSeparator>
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
  const value = useAtomValue(row.value) as Record<string, unknown>
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
    <>
      <div
        aria-label={`${label} item ${index + 1}`}
        className={styles.ListFieldRow()}
        data-dragging={isDragging || undefined}
        data-first-row={index === 0 ? 'true' : undefined}
        role="listitem"
      >
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
            expanded={expanded}
            isCopied={isCopied}
            isDragging={isDragging}
            isFirstRow={index === 0}
            isLastRow={index === rows - 1}
            label={label}
            readOnly={readOnly}
            typeIcon={typeIcon}
            onCopy={() => onCopyRow(itemId)}
            onDelete={deleteRow}
            onMoveDown={() => moveCurrentRow(1)}
            onMoveUp={() => moveCurrentRow(-1)}
            onToggle={() => onToggleRow(itemId)}
          />
        </SurfaceHeader>
        {expanded && (
          <div className={styles.ListFieldRow.body()}>
            <NodeEditor node={row as ReactiveNode<object>} type={type} />
          </div>
        )}
        {!expanded && (
          <div className={styles.ListFieldRow.footer()}>
            <CompactRecordFields
              fields={Type.fields(type)}
              layout="footer"
              value={value}
            />
          </div>
        )}
      </div>
      {index < rows - 1 && (
        <ListFieldSeparator
          items={typeItems}
          label={label}
          pasted={pasted && schema[pasted._type] ? pasted : undefined}
          onMoveRow={onMoveRow}
          onPaste={(row, position) => addBetweenRow(cloneRow(row), position)}
          onSelect={(item, position) =>
            addBetweenRow(createRow(item.id, item.type), position)
          }
          position="after"
          readOnly={readOnly}
          targetIndex={insertIndex(index, 'after')}
        />
      )}
      {index === rows - 1 && (
        <ListFieldSeparator
          items={typeItems}
          label={label}
          pasted={pasted && schema[pasted._type] ? pasted : undefined}
          showPicker={false}
          onMoveRow={onMoveRow}
          onPaste={(row, position) => addBetweenRow(cloneRow(row), position)}
          onSelect={(item, position) =>
            addBetweenRow(createRow(item.id, item.type), position)
          }
          position="after"
          readOnly={readOnly}
          targetIndex={insertIndex(index, 'after')}
        />
      )}
    </>
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
  expanded: boolean
  isCopied: boolean
  isDragging: boolean
  isFirstRow: boolean
  isLastRow: boolean
  isPreview?: boolean
  label: string
  readOnly: boolean
  typeIcon: ComponentType
  onCopy?: () => void
  onDelete?: () => void
  onMoveDown?: () => void
  onMoveUp?: () => void
  onToggle?: () => void
}

function ListFieldRowHeader({
  dragProps,
  expanded,
  isCopied,
  isDragging,
  isFirstRow,
  isLastRow,
  isPreview,
  label,
  readOnly,
  typeIcon,
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
        className={styles.ListFieldRow.drag()}
        data-dragging={isDragging || undefined}
      >
        <Button
          appearance="plain"
          aria-label={
            isPreview
              ? undefined
              : expanded
                ? `Collapse ${label}`
                : `Expand ${label}`
          }
          className={styles.ListFieldRow.toggle()}
          data-expanded={expanded ? 'true' : undefined}
          isDisabled={isPreview}
          onPress={onToggle}
        >
          <Icon
            aria-hidden
            className={styles.ListFieldRow.icon()}
            icon={typeIcon}
          />
          <strong className={styles.ListFieldRow.title()}>{label}</strong>
          {/*<FoldIcon
            aria-hidden
            className={styles.ListFieldRow.foldIcon()}
            expanded={expanded}
          />*/}
        </Button>
      </div>
      <div className={styles.ListFieldRow.actions()}>
        <DialogTrigger>
          <Button
            appearance="plain"
            size="icon-small"
            icon={IcRoundMoreHoriz}
          />
          <Popover placement="bottom right">
            <div className={styles.ListFieldRow.settings()}>
              <TextField label="Label" autoFocus />
              <TextField label="Anchor" />
            </div>
            <MenuSeparator />
            <Button appearance="plain" onPress={onCopy}>
              <Icon icon={IcBaselineContentCopy} />
              Copy
            </Button>
            <MenuSeparator />
            {!isFirstRow && (
              <Button appearance="plain" onPress={onMoveUp}>
                <Icon icon={IcRoundArrowUpward} />
                Move up
              </Button>
            )}
            {!isLastRow && (
              <Button appearance="plain" onPress={onMoveDown}>
                <Icon icon={IcRoundArrowDownward} />
                Move down
              </Button>
            )}
            {isFirstRow && (
              <Button appearance="plain">
                <Icon icon={IcRoundFirstPage} />
                Insert before
              </Button>
            )}
            <Button appearance="plain">
              <Icon icon={IcRoundLastPage} />
              Insert afer
            </Button>
            <MenuSeparator />
            <Button
              appearance="plain"
              onPress={onDelete}
              isDisabled={readOnly || isPreview}
            >
              <Icon icon={IcRoundClose} />
              Delete
            </Button>
          </Popover>
        </DialogTrigger>

        {/*<Button
          aria-label={isCopied ? `${label} is copied` : `Copy ${label}`}
          appearance={isCopied ? 'active' : 'plain'}
          isDisabled={readOnly || isPreview}
          onPress={onCopy}
          size="icon-small"
          icon={IcBaselineContentCopy}
        />
        <Button
          aria-label={`Remove ${label}`}
          appearance="plain"
          isDisabled={readOnly || isPreview}
          onPress={onDelete}
          size="icon-small"
          icon={IcRoundClose}
        />*/}
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
        size="icon"
        icon={triggerIcon}
      />
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
      <Icon
        aria-hidden
        icon={item.icon}
        className={styles.ListFieldTypePicker.item.icon()}
      />
      <span>{item.label}</span>
    </ListBoxItem>
  )
}
