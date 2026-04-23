import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {ListField as CoreListField} from '#/core/field/ListField.js'
import {ListRow} from '#/core/shape/ListShape.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
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
import {
  Button,
  Dialog,
  DialogTrigger,
  Icon,
  Label,
  Popover,
  SearchField
} from 'alinea/components'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import type {ComponentType} from 'react'
import {useContext, useMemo, useState} from 'react'
import {useFilter} from 'react-aria'
import {
  Autocomplete,
  ListBox,
  ListBoxItem,
  OverlayTriggerStateContext
} from 'react-aria-components'
import {Surface, SurfaceContent, SurfaceHeader} from '../../ui/Surface.js'
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
      atom(null, get => {
        const nodes = get(list.nodes) as Array<ReactiveNode<ListValue>>
        return nodes.map(node => get(node.field('_id')) as string)
      }),
    [list]
  )
  const getRowIds = useSetAtom(rowIdsAtom)
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
    setFoldedIds(allExpanded ? new Set(getRowIds()) : new Set())
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

  const foldAll = hasRows ? (
    <Button
      aria-label={allExpanded ? 'Collapse all items' : 'Expand all items'}
      appearance="plain"
      className={styles.ListFieldView.fold()}
      data-expanded={allExpanded ? 'true' : undefined}
      onPress={toggleAll}
    >
      <Icon aria-hidden icon={IcRoundKeyboardArrowRight} />
    </Button>
  ) : undefined

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
              key={`${row.value}`}
              addBetweenRow={(value, position = 'after') =>
                insertRow(insertIndex(index, position), value)
              }
              copiedRowId={pasted?._id}
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
  const visibleItems = items.slice(0, 5)
  const hasMenu = items.length > visibleItems.length
  return (
    <div className={styles.ListFieldView.create()}>
      {pasted && (
        <Button
          appearance="outline"
          className={styles.ListFieldView.createButton()}
          intent="secondary"
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
          intent="secondary"
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
          triggerIcon={IcRoundMoreVert}
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
  addBetweenRow: (row: ListValue, position?: 'before' | 'after') => void
}

interface ListFieldSeparatorProps {
  label: string
  position: 'before' | 'after'
  readOnly: boolean
  items: Array<ListFieldTypeItem>
  pasted?: ListValue
  onPaste: (row: ListValue, position: 'before' | 'after') => void
  onSelect: (item: ListFieldTypeItem, position: 'before' | 'after') => void
}

function ListFieldSeparator({
  label,
  position,
  readOnly,
  items,
  pasted,
  onPaste,
  onSelect
}: ListFieldSeparatorProps) {
  return (
    <div className={styles.ListFieldRow.separator()}>
      <ListFieldTypePicker
        className={styles.ListFieldRow.separatorPicker()}
        isDisabled={readOnly}
        items={items}
        label={`Add ${label} ${position}`}
        pasted={pasted}
        pasteLabel={pasted ? pasteBlockLabel(pasted, items) : undefined}
        onPaste={row => onPaste(row, position)}
        onSelect={item => onSelect(item, position)}
      />
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
  addBetweenRow
}: ListFieldRowProps) {
  const itemId = useAtomValue(row.field('_id')) as string
  const typeName = useAtomValue(row.field('_type')) as string
  const moveListRow = useSetAtom(list.move)
  const removeRow = useSetAtom(list.remove)
  const type = schema[typeName]
  if (!type) return null

  const label = Type.label(type)
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
      role="listitem"
    >
      {index === 0 && (
        <ListFieldSeparator
          items={typeItems}
          label={label}
          pasted={pasted && schema[pasted._type] ? pasted : undefined}
          onPaste={(row, position) => addBetweenRow(cloneRow(row), position)}
          onSelect={(item, position) =>
            addBetweenRow(createRow(item.id, item.type), position)
          }
          position="before"
          readOnly={readOnly}
        />
      )}
      <SurfaceHeader
        className={styles.ListFieldRow.header()}
        data-expanded={expanded ? 'true' : undefined}
      >
        <div className={styles.ListFieldRow.leading()}>
          <Button
            appearance="plain"
            aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
            className={styles.ListFieldRow.fold()}
            intent="secondary"
            onPress={() => onToggleRow(itemId)}
          >
            <Icon aria-hidden icon={IcRoundKeyboardArrowRight} />
          </Button>
          <strong className={styles.ListFieldRow.title()}>{label}</strong>
        </div>
        <div className={styles.ListFieldRow.actions()}>
          <Button
            aria-label={isCopied ? `${label} is copied` : `Copy ${label}`}
            appearance={isCopied ? 'active' : undefined}
            className={styles.ListFieldRow.action()}
            isDisabled={readOnly}
            onPress={() => onCopyRow(itemId)}
            size="icon"
          >
            <Icon aria-hidden data-slot="icon" icon={IcBaselineContentCopy} />
          </Button>
          <Button
            aria-label={`Move ${label} up`}
            className={styles.ListFieldRow.action()}
            isDisabled={readOnly || index === 0}
            onPress={() => moveCurrentRow(-1)}
            size="icon"
          >
            <Icon aria-hidden icon={IcRoundArrowUpward} />
          </Button>
          <Button
            aria-label={`Move ${label} down`}
            className={styles.ListFieldRow.action()}
            isDisabled={readOnly || index === rows - 1}
            onPress={() => moveCurrentRow(1)}
            size="icon"
          >
            <Icon aria-hidden icon={IcRoundArrowDownward} />
          </Button>
          <Button
            aria-label={`Remove ${label}`}
            className={styles.ListFieldRow.action()}
            isDisabled={readOnly}
            onPress={deleteRow}
            size="icon"
          >
            <Icon aria-hidden icon={IcRoundClose} />
          </Button>
        </div>
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
        onPaste={(row, position) => addBetweenRow(cloneRow(row), position)}
        onSelect={(item, position) =>
          addBetweenRow(createRow(item.id, item.type), position)
        }
        position="after"
        readOnly={readOnly}
      />
    </section>
  )
}

interface ListFieldTypePickerProps {
  className?: string
  isDisabled?: boolean
  items: Array<ListFieldTypeItem>
  label: string
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
  pasted,
  pasteLabel,
  triggerIcon = IcRoundAdd,
  onPaste,
  onSelect
}: ListFieldTypePickerProps) {
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

  return (
    <DialogTrigger>
      <Button
        appearance="outline"
        aria-label={label}
        className={styles.ListFieldTypePicker.trigger(
          styler.merge({className})
        )}
        isDisabled={isDisabled}
        intent="secondary"
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
