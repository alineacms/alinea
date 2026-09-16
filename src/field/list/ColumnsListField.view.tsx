import {
  Button,
  DialogTrigger,
  List,
  ListCreateRow,
  ListError,
  ListLabel,
  ListRow,
  ListRowActions,
  ListRowBadges,
  ListRowBody,
  ListRowDrag,
  ListRowFoldButton,
  ListRowHeader,
  ListRowMeta,
  ListRowSettings,
  ListRowType,
  MenuSeparator,
  Popover,
  TextField,
  TypeCreateActions,
  TypePicker,
  TypePickerPanel,
  type TypePickerItem
} from '#/components.js'
import type {ListField} from '#/core/field/ListField.js'
import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import type {ListRow as CoreListRow} from '#/core/ListRow.js'
import type {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/EntryFields.js'
import {Badge} from '#/dashboard/app/Badge.js'
import {SlugField} from '#/field/path/SlugField.js'
import type {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
  useFieldError,
  useFieldNode,
  useFieldOptions,
  useNodes
} from '#/dashboard/hooks.js'
import {
  IcBaselineContentCopy,
  IcRoundAdd,
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundClose,
  IcRoundFirstPage,
  IcRoundLastPage,
  IcRoundMoreHoriz,
  IcRoundNotes
} from '#/dashboard/icons.js'
import type {ColumnsListOptions} from '#/field/list.js'
import {slugify} from '#/core/util/Slugs.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import type {ChangeEvent, ComponentType, CSSProperties, RefObject} from 'react'
import {useMemo, useRef, useState} from 'react'
import {
  type DragItem,
  type DropItem,
  useDrag,
  useDrop,
  useFocusRing,
  useLocale,
  useMove,
  VisuallyHidden
} from 'react-aria'
import css from './ColumnsListField.module.css'
import {
  appendColumn,
  columnLayout,
  columnsMax,
  columnsMinSpan,
  columnsTracks,
  type ColumnsListGroup,
  type ColumnsListValue,
  groupColumnsList,
  insertColumnsRow,
  moveColumnsRow,
  reindexColumnsList,
  removeColumnsRow,
  resizeColumnBoundary
} from './ColumnsListField.js'

const styles = styler(css)
const COLUMNS_ROW_DRAG_TYPE = 'application/x-alinea-columns-row'

interface ColumnsListTypeItem {
  id: string
  label: string
  type: Schema[string]
}

type SetColumnsListValue = (
  update:
    | Array<ColumnsListValue>
    | ((current: Array<ColumnsListValue>) => Array<ColumnsListValue>)
) => void

export interface ColumnsListFieldViewProps {
  field: ListField<CoreListRow, ColumnsListValue, ColumnsListOptions<Schema>>
}

export function ColumnsListFieldView({field}: ColumnsListFieldViewProps) {
  const options = useFieldOptions(field) as ColumnsListOptions<Schema>
  const error = useFieldError(field)
  const list = useFieldNode(field) as ReactiveNode<Array<ColumnsListValue>>
  const nodes = useNodes(list) as Array<ReactiveNode<ColumnsListValue>>
  const values = useAtomValueRaw(list.value)
  const setValue = useSetAtom(list.value)
  const groups = groupColumnsList(values)
  const [foldedIds, setFoldedIds] = useState<Set<string>>(() => new Set())
  const typeItems = useMemo(
    () =>
      Object.entries(options.schema).map(([id, type]) => ({
        id,
        label: Type.label(type),
        type
      })),
    [options.schema]
  )
  const readOnly = Boolean(options.readOnly)
  const hasRows = groups.length > 0
  const allExpanded = hasRows && groups.every(group => !foldedIds.has(group.id))

  function toggleAll() {
    setFoldedIds(
      allExpanded ? new Set(groups.map(group => group.id)) : new Set()
    )
  }

  function toggleRow(rowId: string) {
    setFoldedIds(current => {
      const next = new Set(current)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  function addRow(item: ColumnsListTypeItem) {
    const rowId = createId()
    setValue(current =>
      reindexColumnsList([
        ...current,
        createListValue(item, {row: rowId, span: columnsTracks})
      ])
    )
  }

  function addColumn(rowId: string, item: ColumnsListTypeItem) {
    setValue(current => appendColumn(current, rowId, createListValue(item)))
  }

  function removeRow(rowId: string) {
    setValue(current => removeColumnsRow(current, rowId))
  }

  function insertRow(
    targetRowId: string,
    position: 'before' | 'after',
    item: ColumnsListTypeItem
  ) {
    const rowId = createId()
    setValue(current =>
      insertColumnsRow(
        current,
        targetRowId,
        [createListValue(item, {row: rowId, span: columnsTracks})],
        position
      )
    )
  }

  function duplicateRow(rowId: string) {
    setValue(current => {
      const group = groupColumnsList(current).find(group => group.id === rowId)
      if (!group) return current
      const nextRowId = createId()
      const duplicates = group.items.map(item => ({
        ...item.value,
        _id: createId(),
        _index: '',
        _layout: {...item.layout, row: nextRowId}
      }))
      return insertColumnsRow(current, rowId, duplicates, 'after')
    })
  }

  function moveRowBy(rowId: string, direction: -1 | 1) {
    setValue(current => {
      const groups = groupColumnsList(current)
      const index = groups.findIndex(group => group.id === rowId)
      const target = groups[index + direction]
      if (!target) return current
      return moveColumnsRow(
        current,
        rowId,
        target.id,
        direction < 0 ? 'before' : 'after'
      )
    })
  }

  function moveRow(
    rowId: string,
    targetRowId: string,
    position: 'before' | 'after'
  ) {
    setValue(current => moveColumnsRow(current, rowId, targetRowId, position))
  }

  const pickerItems = typePickerItems(typeItems, addRow)

  return (
    <div className={styles.ColumnsListFieldView()}>
      <ListLabel
        aria-label={
          hasRows
            ? allExpanded
              ? 'Collapse all rows'
              : 'Expand all rows'
            : 'No rows to fold'
        }
        count={groups.length}
        description={options.help}
        expanded={allExpanded}
        hasRows={hasRows}
        inline={options.inline}
        isDisabled={!hasRows}
        onPress={toggleAll}
        shared={options.shared}
      >
        {options.label}
      </ListLabel>
      {hasRows && (
        <List aria-label={options.label || 'Column rows'}>
          {groups.map((group, index) => (
            <ColumnsListRow
              expanded={!foldedIds.has(group.id)}
              first={index === 0}
              group={group}
              key={group.id}
              nodes={nodes}
              onAddColumn={item => addColumn(group.id, item)}
              onDuplicate={() => duplicateRow(group.id)}
              onInsert={(position, item) => insertRow(group.id, position, item)}
              onMoveDown={() => moveRowBy(group.id, 1)}
              onRemove={() => removeRow(group.id)}
              onMoveRow={moveRow}
              onMoveUp={() => moveRowBy(group.id, -1)}
              onToggle={() => toggleRow(group.id)}
              readOnly={readOnly}
              rowIndex={index}
              rows={groups.length}
              schema={options.schema}
              setValue={setValue}
              typeItems={typeItems}
            />
          ))}
        </List>
      )}
      {!readOnly && (
        <ListCreateRow empty={!hasRows}>
          <TypeCreateActions items={pickerItems} label="More field types" />
        </ListCreateRow>
      )}
      {error && <ListError>{error}</ListError>}
    </div>
  )
}

interface ColumnsListRowProps {
  expanded: boolean
  first: boolean
  group: ColumnsListGroup
  nodes: Array<ReactiveNode<ColumnsListValue>>
  readOnly: boolean
  rowIndex: number
  rows: number
  schema: Schema
  setValue: SetColumnsListValue
  typeItems: Array<ColumnsListTypeItem>
  onAddColumn: (item: ColumnsListTypeItem) => void
  onDuplicate: () => void
  onInsert: (position: 'before' | 'after', item: ColumnsListTypeItem) => void
  onMoveDown: () => void
  onMoveRow: (
    rowId: string,
    targetRowId: string,
    position: 'before' | 'after'
  ) => void
  onRemove: () => void
  onMoveUp: () => void
  onToggle: () => void
}

function ColumnsListRow({
  expanded,
  first,
  group,
  nodes,
  readOnly,
  rowIndex,
  rows,
  schema,
  setValue,
  typeItems,
  onAddColumn,
  onDuplicate,
  onInsert,
  onMoveDown,
  onMoveRow,
  onRemove,
  onMoveUp,
  onToggle
}: ColumnsListRowProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(
    null
  )
  const template = group.items.map(item => `${item.layout.span}fr`).join(' ')
  const headerStyle = {gridTemplateColumns: template}
  const pickerItems = typePickerItems(typeItems, onAddColumn)
  const {dragProps, isDragging} = useDrag({
    getItems() {
      return [columnsRowDragItem(group.id)]
    },
    getAllowedDropOperations() {
      return ['move']
    },
    isDisabled: readOnly
  })
  const {dropProps, isDropTarget} = useDrop({
    ref: rowRef,
    isDisabled: readOnly,
    getDropOperation(types, allowedOperations) {
      if (!types.has(COLUMNS_ROW_DRAG_TYPE)) return 'cancel'
      return allowedOperations.includes('move') ? 'move' : 'cancel'
    },
    onDropEnter(event) {
      setDropPosition(columnsRowDropPosition(rowRef.current, event.y))
    },
    onDropMove(event) {
      setDropPosition(columnsRowDropPosition(rowRef.current, event.y))
    },
    onDropExit() {
      setDropPosition(null)
    },
    async onDrop(event) {
      const rowId = await draggedColumnsRowId(event.items)
      const position = columnsRowDropPosition(rowRef.current, event.y)
      setDropPosition(null)
      if (!rowId) return
      onMoveRow(rowId, group.id, position)
    }
  })

  return (
    <div
      {...dropProps}
      className={styles.ColumnsListFieldView.rowDropTarget()}
      ref={rowRef}
    >
      {isDropTarget && dropPosition && (
        <div
          aria-hidden
          className={styles.ColumnsListFieldView.dropIndicator()}
          data-position={dropPosition}
        />
      )}
      <ListRow
        aria-label="Field row"
        dragging={isDragging}
        first={first}
        role="listitem"
      >
        <ListRowHeader
          className={styles.ColumnsListFieldView.rowHeader()}
          expanded={expanded}
          first={first}
          onToggle={onToggle}
        >
          <ListRowDrag
            {...dragProps}
            className={styles.ColumnsListFieldView.rowDrag()}
            dragging={isDragging}
          >
            <ListRowBadges className={styles.ColumnsListFieldView.rowBadges()}>
              <ListRowFoldButton
                aria-label={
                  expanded ? 'Collapse field row' : 'Expand field row'
                }
                className={styles.ColumnsListFieldView.foldButton()}
                expanded={expanded}
                onPress={onToggle}
              />
              <div
                className={styles.ColumnsListFieldView.headerGrid()}
                style={headerStyle}
              >
                {group.items.map((item, index) => (
                  <ColumnSummary
                    first={index === 0}
                    last={index === group.items.length - 1}
                    key={item.value._id}
                    node={nodes[item.index]}
                    schema={schema}
                  />
                ))}
              </div>
            </ListRowBadges>
          </ListRowDrag>
          <ListRowActions className={styles.ColumnsListFieldView.rowActions()}>
            {!readOnly && group.items.length < columnsMax && (
              <TypePicker
                items={pickerItems}
                label="Add a column"
                trigger={
                  <Button
                    appearance="plain"
                    aria-label="Add column"
                    icon={IcRoundAdd}
                    size="icon-small"
                  />
                }
              />
            )}
            {!readOnly && (
              <ColumnsRowActions
                canMoveDown={rowIndex < rows - 1}
                canMoveUp={rowIndex > 0}
                items={typeItems}
                onDuplicate={onDuplicate}
                onInsert={onInsert}
                onMoveDown={onMoveDown}
                onMoveUp={onMoveUp}
              />
            )}
            <Button
              appearance="plain"
              aria-label="Remove field row"
              icon={IcRoundClose}
              isDisabled={readOnly}
              onPress={onRemove}
              size="icon-small"
            />
          </ListRowActions>
        </ListRowHeader>
        {expanded && (
          <ListRowBody className={styles.ColumnsListFieldView.rowBody()}>
            <div className={styles.ColumnsListFieldView.grid()} ref={gridRef}>
              {group.items.map((item, index) => {
                const type = schema[item.value._type]
                if (!type) return null
                const style = {
                  '--alinea-column-span': item.layout.span
                } as CSSProperties
                return (
                  <div
                    className={styles.ColumnsListFieldView.column()}
                    data-first-column={index === 0 || undefined}
                    data-last-column={
                      index === group.items.length - 1 || undefined
                    }
                    key={item.value._id}
                    style={style}
                  >
                    <NodeEditor
                      node={nodes[item.index] as ReactiveNode<object>}
                      type={type}
                    />
                  </div>
                )
              })}
              {group.items.slice(0, -1).map((item, index) => (
                <ColumnsResizer
                  gridRef={gridRef}
                  key={item.value._id}
                  left={item.value}
                  leftIndex={index}
                  offset={group.items
                    .slice(0, index + 1)
                    .reduce((sum, current) => sum + current.layout.span, 0)}
                  right={group.items[index + 1].value}
                  rowId={group.id}
                  setValue={setValue}
                />
              ))}
            </div>
          </ListRowBody>
        )}
      </ListRow>
    </div>
  )
}

interface ColumnsRowActionsProps {
  canMoveDown: boolean
  canMoveUp: boolean
  items: Array<ColumnsListTypeItem>
  onDuplicate: () => void
  onInsert: (position: 'before' | 'after', item: ColumnsListTypeItem) => void
  onMoveDown: () => void
  onMoveUp: () => void
}

function ColumnsRowActions({
  canMoveDown,
  canMoveUp,
  items,
  onDuplicate,
  onInsert,
  onMoveDown,
  onMoveUp
}: ColumnsRowActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [insertPosition, setInsertPosition] = useState<
    'before' | 'after' | null
  >(null)

  function close() {
    setIsOpen(false)
    setInsertPosition(null)
  }

  const pickerItems = insertPosition
    ? typePickerItems(items, item => {
        onInsert(insertPosition, item)
        close()
      })
    : []

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={nextOpen => {
        setIsOpen(nextOpen)
        if (!nextOpen) setInsertPosition(null)
      }}
    >
      <Button
        appearance="plain"
        aria-label="Field row actions"
        icon={IcRoundMoreHoriz}
        size="icon-small"
      />
      <Popover placement="bottom right">
        {insertPosition ? (
          <TypePickerPanel
            items={pickerItems}
            label={`Insert field row ${insertPosition}`}
          />
        ) : (
          <>
            <ListRowSettings actions>
              <Button
                appearance="plain"
                icon={IcBaselineContentCopy}
                onPress={() => {
                  onDuplicate()
                  close()
                }}
              >
                Duplicate row
              </Button>
            </ListRowSettings>
            <MenuSeparator />
            <ListRowSettings actions>
              {canMoveUp && (
                <Button
                  appearance="plain"
                  icon={IcRoundArrowUpward}
                  onPress={() => {
                    onMoveUp()
                    close()
                  }}
                >
                  Move up
                </Button>
              )}
              {canMoveDown && (
                <Button
                  appearance="plain"
                  icon={IcRoundArrowDownward}
                  onPress={() => {
                    onMoveDown()
                    close()
                  }}
                >
                  Move down
                </Button>
              )}
              <Button
                appearance="plain"
                icon={IcRoundFirstPage}
                onPress={() => setInsertPosition('before')}
              >
                Insert before
              </Button>
              <Button
                appearance="plain"
                icon={IcRoundLastPage}
                onPress={() => setInsertPosition('after')}
              >
                Insert after
              </Button>
            </ListRowSettings>
          </>
        )}
      </Popover>
    </DialogTrigger>
  )
}

interface ColumnSummaryProps {
  first: boolean
  last: boolean
  node: ReactiveNode<ColumnsListValue>
  schema: Schema
}

function ColumnSummary({first, last, node, schema}: ColumnSummaryProps) {
  const value = useAtomValueRaw(node.value)
  const customLabelValue = useAtomValueRaw(node.field('_label')) as
    | string
    | undefined
  const anchorValue = useAtomValueRaw(node.field('_anchor')) as
    | string
    | undefined
  const setCustomLabel = useSetAtom(node.field('_label'))
  const setAnchor = useSetAtom(node.field('_anchor'))
  const type = schema[value._type]
  if (!type) return null
  const label = Type.label(type)
  const icon = getType(type).icon || IcRoundNotes

  function updateCustomLabel(nextValue: string) {
    const currentLabel = customLabelValue ?? ''
    setCustomLabel(nextValue || undefined)
    const shouldSyncAnchor =
      anchorValue === undefined || anchorValue === slugify(currentLabel)
    if (shouldSyncAnchor) setAnchor(slugify(nextValue) || undefined)
  }

  function updateAnchor(nextValue: string) {
    setAnchor(slugify(nextValue.replace(/^#+/, '')) || undefined)
  }

  return (
    <div
      className={styles.ColumnsListFieldView.headerColumn()}
      data-first-column={first || undefined}
      data-last-column={last || undefined}
    >
      <ListRowType icon={icon}>{label}</ListRowType>
      <ColumnSettings
        anchor={anchorValue}
        label={customLabelValue ?? ''}
        typeLabel={label}
        onAnchorChange={updateAnchor}
        onLabelChange={updateCustomLabel}
      />
      {customLabelValue && <ListRowMeta>{customLabelValue}</ListRowMeta>}
      {anchorValue && !customLabelValue && (
        <Badge size="small">#{anchorValue}</Badge>
      )}
    </div>
  )
}

interface ColumnSettingsProps {
  anchor?: string
  label: string
  typeLabel: string
  onAnchorChange: (value: string) => void
  onLabelChange: (value: string) => void
}

function ColumnSettings({
  anchor,
  label,
  typeLabel,
  onAnchorChange,
  onLabelChange
}: ColumnSettingsProps) {
  return (
    <DialogTrigger>
      <Button
        appearance="plain"
        aria-label={`${typeLabel} settings`}
        icon={IcRoundMoreHoriz}
        size="icon-small"
      />
      <Popover placement="bottom right">
        <ListRowSettings>
          <TextField
            autoFocus
            label="Label"
            onChange={onLabelChange}
            value={label}
          />
          <SlugField
            fieldValue={anchor}
            label="Anchor"
            onChange={onAnchorChange}
            source={label}
          />
        </ListRowSettings>
      </Popover>
    </DialogTrigger>
  )
}

interface ColumnsResizerProps {
  gridRef: RefObject<HTMLDivElement | null>
  left: ColumnsListValue
  leftIndex: number
  offset: number
  right: ColumnsListValue
  rowId: string
  setValue: SetColumnsListValue
}

function ColumnsResizer({
  gridRef,
  left,
  leftIndex,
  offset,
  right,
  rowId,
  setValue
}: ColumnsResizerProps) {
  const leftSpan = columnLayout(left).span
  const rightSpan = columnLayout(right).span
  const pairSpan = leftSpan + rightSpan
  const inputRef = useRef<HTMLInputElement>(null)
  const start = useRef({left: leftSpan, right: rightSpan, pixels: 0})
  const {direction} = useLocale()
  const {focusProps, isFocusVisible} = useFocusRing()

  function setBoundary(nextLeft: number) {
    setValue(current =>
      resizeColumnBoundary(current, left._id, right._id, nextLeft)
    )
  }

  const {moveProps} = useMove({
    onMoveStart() {
      start.current = {left: leftSpan, right: rightSpan, pixels: 0}
      inputRef.current?.focus()
    },
    onMove(event) {
      const deltaX = direction === 'rtl' ? -event.deltaX : event.deltaX
      if (event.pointerType === 'keyboard') {
        setBoundary(leftSpan + deltaX)
        return
      }
      start.current.pixels += deltaX
      const trackWidth = (gridRef.current?.clientWidth ?? 0) / columnsTracks
      if (!trackWidth) return
      const delta = Math.round(start.current.pixels / trackWidth)
      setBoundary(start.current.left + delta)
    }
  })

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setBoundary(Number(event.currentTarget.value))
  }

  const style = {'--alinea-column-offset': offset} as CSSProperties
  return (
    <div
      {...moveProps}
      className={styles.ColumnsListFieldView.resizer()}
      data-focus-visible={isFocusVisible || undefined}
      style={style}
    >
      <VisuallyHidden>
        <input
          {...focusProps}
          aria-label={`Resize columns ${leftIndex + 1} and ${leftIndex + 2}`}
          aria-orientation="horizontal"
          aria-valuetext={`${leftSpan} and ${rightSpan} of ${columnsTracks} tracks in row ${rowId}`}
          max={pairSpan - columnsMinSpan}
          min={columnsMinSpan}
          onChange={handleChange}
          ref={inputRef}
          step={1}
          type="range"
          value={leftSpan}
        />
      </VisuallyHidden>
      <span aria-hidden className={styles.ColumnsListFieldView.resizerLine()} />
      <span aria-hidden className={styles.ColumnsListFieldView.resizerHandle()}>
        {leftSpan}/{rightSpan}
      </span>
    </div>
  )
}

function createListValue(
  item: ColumnsListTypeItem,
  layout?: CoreListRow['_layout']
): ColumnsListValue {
  return {
    _id: createId(),
    _index: '',
    _type: item.id,
    ...Type.initialValue(item.type),
    _layout: layout
  }
}

function typePickerItems(
  items: Array<ColumnsListTypeItem>,
  onSelect: (item: ColumnsListTypeItem) => void
): Array<TypePickerItem> {
  return items.map(item => ({
    colorName: item.label,
    icon: (getType(item.type).icon || IcRoundNotes) as ComponentType,
    id: item.id,
    label: item.label,
    onSelect: () => onSelect(item)
  }))
}

function columnsRowDragItem(id: string): DragItem {
  return {
    'text/plain': id,
    [COLUMNS_ROW_DRAG_TYPE]: id
  }
}

async function draggedColumnsRowId(
  items: Array<DropItem>
): Promise<string | null> {
  for (const item of items) {
    if (
      item.kind === 'text' &&
      item.types.has(COLUMNS_ROW_DRAG_TYPE) &&
      item.getText
    ) {
      return item.getText(COLUMNS_ROW_DRAG_TYPE)
    }
  }
  return null
}

function columnsRowDropPosition(
  row: HTMLDivElement | null,
  y: number
): 'before' | 'after' {
  if (!row) return 'after'
  return y < row.offsetHeight / 2 ? 'before' : 'after'
}
