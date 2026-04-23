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
  IcRoundCheck,
  IcRoundClose,
  IcRoundKeyboardArrowRight,
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
import {Button, Icon, Label} from 'alinea/components'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import {useMemo, useState} from 'react'
import {
  Surface,
  SurfaceContent,
  SurfaceHeader,
  SurfaceRow
} from '../../ui/Surface.js'
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

export interface ListFieldViewProps {
  field: CoreListField<ListRow, ListValue, ListOptions<Schema>>
}

export function ListFieldView({field}: ListFieldViewProps) {
  const options = useFieldOptions(field) as ListOptions<Schema>
  const error = useFieldError(field)
  const list = useFieldNode(field) as ReactiveNode<Array<ListValue>>
  const nodes = useNodes(list) as Array<ReactiveNode<ListValue>>
  const pushRow = useSetAtom(list.push)
  const pasted = useAtomValue(copyAtom)
  const setPasted = useSetAtom(copyAtom)
  const schemaEntries = useMemo(
    () => Object.entries(options.schema),
    [options.schema]
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
  const insertRowAtom = useMemo(
    () =>
      atom(
        null,
        (
          get,
          set,
          centralRow: ReactiveNode<ListValue>,
          typeName: string,
          position: 'before' | 'after'
        ) => {
          const type = options.schema[typeName]
          if (!type) return
          const centralRowId = get(centralRow.field('_id')) as string
          const current = get(list.value)
          const positionIndex = position === 'after' ? 1 : -1
          const insertAt = current.findIndex(row => row._id === centralRowId)
          if (insertAt === -1) return
          const next = [...current]
          next.splice(insertAt + positionIndex, 0, createRow(typeName, type))
          set(list.value, next)
        }
      ),
    [list, options.schema]
  )
  const insertRow = useSetAtom(insertRowAtom)
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

  function pasteRow(row: ListValue) {
    pushRow(cloneRow(row))
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
              key={index}
              addBetweenRow={(typeName, position = 'after') =>
                insertRow(row, typeName, position)
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
            />
          ))}
        </div>
      )}
      {!readOnly && (
        <SurfaceContent className={styles.ListFieldView.createRow()}>
          <div className={styles.ListFieldView.create()}>
            {schemaEntries.map(([typeName, type]) => (
              <Button
                key={typeName}
                appearance="outline"
                intent="secondary"
                size="small"
                onPress={() => addRow(typeName, type)}
              >
                <Icon aria-hidden icon={getType(type).icon || IcRoundAdd} />
                {`Add ${Type.label(type)}`}
              </Button>
            ))}
            {pasted && options.schema[pasted._type] && (
              <Button
                appearance="outline"
                intent="secondary"
                size="small"
                onPress={() => pasteRow(pasted)}
              >
                <Icon aria-hidden icon={IcBaselineContentPasteGo} />
                Paste block
              </Button>
            )}
          </div>
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

interface ListFieldRowProps {
  index: number
  list: ReactiveNode<Array<ListValue>>
  readOnly: boolean
  row: ReactiveNode<ListValue>
  rows: number
  schema: Schema
  foldedIds: Set<string>
  copiedRowId?: string
  onToggleRow: (rowId: string) => void
  onCopyRow: (rowId: string) => void
  addBetweenRow: (typeName: string, position?: 'before' | 'after') => void
}

interface ListFieldSeparatorProps {
  label: string
  position: 'before' | 'after'
  isOpen: boolean
  readOnly: boolean
  addBetweenOpen: boolean
  onPress: (position: 'before' | 'after') => void
}

function ListFieldSeparator({
  label,
  position,
  isOpen,
  readOnly,
  addBetweenOpen,
  onPress
}: ListFieldSeparatorProps) {
  return (
    <div
      className={styles.ListFieldRow.separator()}
      data-open={isOpen ? 'true' : undefined}
    >
      <Button
        aria-expanded={addBetweenOpen}
        aria-label={`Add ${label} ${position}`}
        className={styles.ListFieldRow.separatorButton()}
        isDisabled={readOnly}
        onPress={() => onPress(position)}
        size="icon"
      >
        <Icon aria-hidden icon={isOpen ? IcRoundClose : IcRoundAdd} />
      </Button>
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
  const [addBetweenPosition, setAddBetweenPosition] = useState<
    'before' | 'after' | null
  >(null)
  if (!type) return null

  const label = Type.label(type)
  const expanded = !foldedIds.has(itemId)
  const isCopied = copiedRowId === itemId
  const addBetweenOpen = addBetweenPosition !== null

  function openAddBetween(position: 'before' | 'after') {
    setAddBetweenPosition(current => (current === position ? null : position))
  }

  function closeAddBetween() {
    setAddBetweenPosition(null)
  }

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
          addBetweenOpen={addBetweenOpen}
          isOpen={addBetweenPosition === 'before'}
          label={label}
          onPress={openAddBetween}
          position="before"
          readOnly={readOnly}
        />
      )}
      {addBetweenPosition === 'before' && (
        <SurfaceRow
          className={styles.ListFieldRow.addBetween()}
          data-open="true"
        >
          <AddBetweenButton
            label={label}
            onPress={() => {
              addBetweenRow(typeName, 'before')
              closeAddBetween()
            }}
            type={type}
          />
        </SurfaceRow>
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
            <Icon
              aria-hidden
              data-slot="icon"
              icon={isCopied ? IcRoundCheck : IcBaselineContentCopy}
            />
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
        addBetweenOpen={addBetweenOpen}
        isOpen={addBetweenPosition === 'after'}
        label={label}
        onPress={openAddBetween}
        position="after"
        readOnly={readOnly}
      />
      {addBetweenPosition === 'after' && (
        <SurfaceRow
          className={styles.ListFieldRow.addBetween()}
          data-open="true"
        >
          <AddBetweenButton
            label={label}
            onPress={() => {
              addBetweenRow(typeName, 'after')
              closeAddBetween()
            }}
            type={type}
          />
        </SurfaceRow>
      )}
    </section>
  )
}

interface AddBetweenButtonProps {
  label: string
  onPress: () => void
  type: Schema[string]
}

function AddBetweenButton({label, onPress, type}: AddBetweenButtonProps) {
  return (
    <div className={styles.ListFieldView.create()}>
      <Button
        appearance="outline"
        intent="secondary"
        onPress={onPress}
        size="small"
      >
        <Icon aria-hidden icon={getType(type).icon || IcRoundAdd} />
        {`Add ${label}`}
      </Button>
    </div>
  )
}
