import {
  Button,
  ListRow as ComponentListRow,
  Dialog,
  DialogTrigger,
  Icon,
  List,
  ListCreateRow,
  ListDragPreview,
  ListError,
  ListLabel,
  ListRowActions,
  ListRowBadges,
  ListRowBody,
  ListRowDrag,
  ListRowDragHandle,
  ListRowFooter,
  ListRowHeader,
  ListRowMeta,
  ListRowSettings,
  ListRowSettingsButton,
  MenuSeparator,
  Popover,
  SearchField,
  TextField
} from '#/components.js'
import {ListField as CoreListField} from '#/core/field/ListField.js'
import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import {ListRow} from '#/core/ListRow.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {slugify} from '#/core/util/Slugs.js'
import {Badge} from '#/dashboard/app/Badge.js'
import {CompactRecordFields} from '#/dashboard/app/CompactField.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
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
import {SlugField} from '#/field/path/SlugField.js'
import styler from '@alinea/styler'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import type {ComponentType} from 'react'
import {
  createContext,
  Fragment,
  useContext,
  useMemo,
  useRef,
  useState
} from 'react'
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
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] =
    useState<ListFieldDropIndicatorState | null>(null)
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

  function isBoundaryDropTarget(index: number) {
    return (
      (dropIndicator?.index === index && dropIndicator.position === 'before') ||
      (dropIndicator?.index === index - 1 && dropIndicator.position === 'after')
    )
  }

  const content = (hasRows || !readOnly) && (
    <>
      <ListFieldDropIndicator
        active={
          dropIndicator?.index === 0 && dropIndicator.position === 'before'
        }
      />
      <List
        aria-label={options.label || 'List items'}
        data-depth={depth % 2 === 0 ? 'muted' : 'base'}
      >
        {nodes.map((row, index) => (
          <Fragment key={rowIds[index] || index}>
            {index > 0 && (
              <ListFieldDropIndicator active={isBoundaryDropTarget(index)} />
            )}
            <ListFieldRow
              addBetweenRow={(value, position = 'after') =>
                insertRow(insertIndex(index, position), value)
              }
              draggingRowId={draggingRowId}
              foldedIds={foldedIds}
              index={index}
              list={list}
              readOnly={readOnly}
              onCopyRow={copyRow}
              onMoveRow={moveRow}
              onRowDragEnd={() => {
                setDraggingRowId(null)
                setDropIndicator(null)
              }}
              onRowDragStart={() => setDraggingRowId(rowIds[index] ?? null)}
              onDropIndicatorChange={position =>
                setDropIndicator(position ? {index, position} : null)
              }
              onToggleRow={toggleRow}
              row={row}
              rows={nodes.length}
              schema={options.schema}
              pasted={pasted}
              typeItems={typeItems}
            />
          </Fragment>
        ))}
        <ListFieldDropIndicator
          active={
            dropIndicator?.index === nodes.length - 1 &&
            dropIndicator.position === 'after'
          }
        />

        {!readOnly && (
          <ListCreateRow empty={!hasRows}>
            <ListFieldCreateActions
              items={typeItems}
              pasted={
                pasted && options.schema[pasted._type] ? pasted : undefined
              }
              onPaste={row => pushRow(cloneRow(row))}
              onSelect={item => addRow(item.id, item.type)}
            />
          </ListCreateRow>
        )}
      </List>
    </>
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
        isDisabled={!hasRows}
        onPress={toggleAll}
        shared={options.shared}
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
  draggingRowId: string | null
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
  onMoveRow: (rowId: string, targetIndex: number) => void
  onRowDragEnd: () => void
  onRowDragStart: () => void
  onDropIndicatorChange: (position: 'before' | 'after' | null) => void
  addBetweenRow: (row: ListValue, position?: 'before' | 'after') => void
}

interface ListFieldDropIndicatorState {
  index: number
  position: 'before' | 'after'
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
        appearance="plain"
        className={styles.ListFieldView.insertAction()}
        icon={icon}
        isDisabled={isDisabled}
        onPress={() => {
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
      appearance="plain"
      className={styles.ListFieldView.insertAction()}
      isDisabled={isDisabled}
      onPress={() => {
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
  const {contains} = useFilter({sensitivity: 'base'})
  const pickerItems = useListFieldPickerItems(
    items,
    pasted,
    pasteLabel,
    onPaste
  )
  return (
    <div className={styles.ListFieldTypePicker.dialog()}>
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
    </div>
  )
}

function ListFieldRow({
  draggingRowId,
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
  onMoveRow,
  onRowDragEnd,
  onRowDragStart,
  onDropIndicatorChange,
  addBetweenRow
}: ListFieldRowProps) {
  const itemId = useAtomValue(row.field('_id')) as string
  const typeName = useAtomValue(row.field('_type')) as string
  const customLabelValue = useAtomValue(row.field('_label')) as
    | string
    | undefined
  const anchorValue = useAtomValue(row.field('_anchor')) as string | undefined
  const customLabel = customLabelValue ?? ''
  const value = useAtomValue(row.value) as Record<string, unknown>
  const setCustomLabel = useSetAtom(row.field('_label'))
  const setAnchor = useSetAtom(row.field('_anchor'))
  const moveListRow = useSetAtom(list.move)
  const removeRow = useSetAtom(list.remove)
  const dragPreview = useRef<DragPreviewRenderer | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const {dragProps, isDragging} = useDrag({
    getItems() {
      return [dragRowItem(itemId)]
    },
    getAllowedDropOperations() {
      return ['move']
    },
    onDragEnd: onRowDragEnd,
    onDragStart: onRowDragStart,
    isDisabled: readOnly,
    preview: dragPreview
  })
  const {dropProps, isDropTarget} = useDrop({
    ref: rowRef,
    isDisabled: readOnly || draggingRowId === null,
    getDropOperation(types, allowedOperations) {
      if (!types.has(LIST_FIELD_ROW_DRAG_TYPE)) return 'cancel'
      return allowedOperations.includes('move') ? 'move' : 'cancel'
    },
    getDropOperationForPoint(types, allowedOperations) {
      if (!types.has(LIST_FIELD_ROW_DRAG_TYPE)) return 'cancel'
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
      const rowId = await getDraggedRowId(event.items, LIST_FIELD_ROW_DRAG_TYPE)
      onDropIndicatorChange(null)
      if (!rowId) return
      onMoveRow(rowId, insertIndex(index, position))
    }
  })
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
    <>
      <div
        {...dropProps}
        className={styles.ListFieldView.rowDropTarget()}
        ref={rowRef}
      >
        <ComponentListRow
          aria-label={`${label} item ${index + 1}`}
          dragging={isDragging}
          first={index === 0}
          role="listitem"
        >
          <DragPreview ref={dragPreview}>
            {() => <ListFieldDragPreview icon={typeIcon} label={label} />}
          </DragPreview>
          <ListFieldRowHeader
            dragProps={dragProps}
            expanded={expanded}
            isDragging={isDragging}
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
            onInsertBefore={(value: ListValue) =>
              addBetweenRow(value, 'before')
            }
            onInsertAfter={(value: ListValue) => addBetweenRow(value, 'after')}
            onMoveDown={() => moveCurrentRow(1)}
            onMoveUp={() => moveCurrentRow(-1)}
            onToggle={() => onToggleRow(itemId)}
          />
          {expanded && (
            <ListRowBody>
              <NodeEditor node={row as ReactiveNode<object>} type={type} />
            </ListRowBody>
          )}
          {!expanded && (
            <ListRowFooter>
              <CompactRecordFields
                fields={Type.fields(type)}
                layout="footer"
                value={value}
              />
            </ListRowFooter>
          )}
        </ComponentListRow>
      </div>
    </>
  )
}

interface ListFieldDropIndicatorProps {
  active: boolean
}

function ListFieldDropIndicator({active}: ListFieldDropIndicatorProps) {
  return (
    <div
      aria-hidden
      className={styles.ListFieldView.dropIndicator()}
      data-active={active || undefined}
    />
  )
}

interface ListFieldDragPreviewProps {
  icon?: ComponentType
  label: string
}

function ListFieldDragPreview({icon, label}: ListFieldDragPreviewProps) {
  return <ListDragPreview icon={icon} label={label} />
}

interface ListFieldRowHeaderProps {
  className?: string
  dragProps?: ReturnType<typeof useDrag>['dragProps']
  expanded: boolean
  isDragging: boolean
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
  className,
  dragProps,
  expanded,
  isDragging,
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
    <ListRowHeader className={className} expanded={expanded} first={isFirstRow}>
      {!readOnly && (
        <ListRowDragHandle
          {...dragProps}
          aria-label={dragLabel}
          dragging={isDragging}
        />
      )}
      <ListRowDrag dragging={isDragging}>
        <ListRowBadges>
          <Badge icon={typeIcon} size="small">
            {label}
          </Badge>
          {displayLabel && <ListRowMeta>{displayLabel}</ListRowMeta>}
          {showAnchor && <Badge size="small">#{displayAnchor}</Badge>}
        </ListRowBadges>
      </ListRowDrag>
      <ListRowActions>
        <DialogTrigger isOpen={actionsOpen} onOpenChange={setActionsOpen}>
          <ListRowSettingsButton icon={IcRoundMoreHoriz} />
          <Popover placement="bottom right">
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
                <ListRowSettings>
                  <TextField
                    label="Label"
                    autoFocus
                    isDisabled={readOnly || isPreview}
                    onChange={onCustomLabelChange}
                    value={customLabel}
                  />
                  <SlugField
                    fieldValue={anchor}
                    label="Anchor"
                    isDisabled={readOnly || isPreview}
                    onChange={onAnchorChange}
                    source={customLabel}
                  />
                </ListRowSettings>
                <MenuSeparator />
                <ListRowSettings actions>
                  <Button
                    appearance="plain"
                    onPress={() => {
                      onCopy?.()
                      closeActions()
                    }}
                  >
                    <Icon icon={IcBaselineContentCopy} />
                    Copy
                  </Button>
                </ListRowSettings>
                <MenuSeparator />
                <ListRowSettings actions>
                  {!isFirstRow && (
                    <Button
                      appearance="plain"
                      onPress={() => {
                        onMoveUp?.()
                        closeActions()
                      }}
                    >
                      <Icon icon={IcRoundArrowUpward} />
                      Move up
                    </Button>
                  )}
                  {!isLastRow && (
                    <Button
                      appearance="plain"
                      onPress={() => {
                        onMoveDown?.()
                        closeActions()
                      }}
                    >
                      <Icon icon={IcRoundArrowDownward} />
                      Move down
                    </Button>
                  )}
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
                </ListRowSettings>
                <MenuSeparator />
                <ListRowSettings actions>
                  <Button
                    appearance="plain"
                    onPress={() => {
                      onDelete?.()
                      closeActions()
                    }}
                    isDisabled={readOnly || isPreview}
                  >
                    <Icon icon={IcRoundClose} />
                    Delete
                  </Button>
                </ListRowSettings>
              </>
            )}
          </Popover>
        </DialogTrigger>
      </ListRowActions>
    </ListRowHeader>
  )
}

function dragRowItem(id: string): DragItem {
  return {
    'text/plain': id,
    [LIST_FIELD_ROW_DRAG_TYPE]: id
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
  const pickerItems = useListFieldPickerItems(
    items,
    pasted,
    pasteLabel,
    onPaste
  )

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)
    onOpenChange?.(nextOpen)
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
