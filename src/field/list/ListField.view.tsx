import styler from '@alinea/styler'
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type DraggableSyntheticListeners,
  KeyboardSensor,
  LayoutMeasuringStrategy,
  PointerSensor,
  closestCenter,
  defaultDropAnimation,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  type AnimateLayoutChanges,
  SortableContext,
  defaultAnimateLayoutChanges,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {CSS, type FirstArgument} from '@dnd-kit/utilities'
import {getType} from 'alinea/core/Internal'
import type {Schema} from 'alinea/core/Schema'
import {Type} from 'alinea/core/Type'
import type {ListField} from 'alinea/core/field/ListField'
import {ListRow} from 'alinea/core/shape/ListShape'
import {entries} from 'alinea/core/util/Objects'
import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useField} from 'alinea/dashboard/editor/UseField'
import {Create} from 'alinea/dashboard/view/Create'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {Icon, TextLabel} from 'alinea/ui'
import {Sink} from 'alinea/ui/Sink'
import {IcBaselineContentCopy} from 'alinea/ui/icons/IcBaselineContentCopy'
import {IcBaselineContentPasteGo} from 'alinea/ui/icons/IcBaselineContentPasteGo'
import {IcOutlineList} from 'alinea/ui/icons/IcOutlineList'
import {IcRoundAdd} from 'alinea/ui/icons/IcRoundAdd'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundDragHandle} from 'alinea/ui/icons/IcRoundDragHandle'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowUp} from 'alinea/ui/icons/IcRoundKeyboardArrowUp'
import {useAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import {
  type CSSProperties,
  type HTMLAttributes,
  type PropsWithChildren,
  type Ref,
  useState
} from 'react'
import type {ListOptions} from './ListField.js'
import css from './ListField.module.scss'

const styles = styler(css)

const copyAtom = atomWithStorage<ListRow | undefined>(
  '@alinea/copypaste',
  undefined
)

function animateLayoutChanges(args: FirstArgument<AnimateLayoutChanges>) {
  const {isSorting, wasSorting} = args
  if (isSorting || wasSorting) return defaultAnimateLayoutChanges(args)
  return true
}

function ListInputRowSortable(props: ListInputRowProps) {
  const {onCreate, onPaste} = props
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({
      animateLayoutChanges,
      id: props.row._id
    })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined
  }
  return (
    <ListInputRow
      {...props}
      rootRef={setNodeRef}
      style={style}
      handle={listeners}
      {...attributes}
      isDragging={isDragging}
      onCreate={onCreate}
      onPaste={onPaste}
    />
  )
}

type ListInputRowProps = PropsWithChildren<
  {
    row: ListRow
    schema: Schema
    isDragging?: boolean
    readOnly?: boolean
    onMove?: (direction: 1 | -1) => void
    onDelete?: () => void
    onCopyBlock?: () => void
    handle?: DraggableSyntheticListeners
    // React ts types force our hand here since it's a generic component,
    // and forwardRef does not forward generics.
    // There's probably an issue for this on DefinitelyTyped.
    rootRef?: Ref<HTMLDivElement>
    isDragOverlay?: boolean
    onCreate?: (type: string) => void
    onPasteBlock?: (data: ListRow) => void
    firstRow?: boolean
  } & HTMLAttributes<HTMLDivElement>
>

function ListInputRow({
  row,
  schema,
  onMove,
  onDelete,
  onCopyBlock,
  handle,
  rootRef,
  isDragging,
  isDragOverlay,
  readOnly,
  onCreate,
  onPasteBlock,
  firstRow,
  ...rest
}: ListInputRowProps) {
  const type = schema[row[ListRow.type]]
  const [showInsert, setShowInsert] = useState(false)
  if (!type) return null
  return (
    <div
      className={styles.row({dragging: isDragging, overlay: isDragOverlay})}
      ref={rootRef}
      {...rest}
    >
      {!readOnly && !isDragOverlay && (
        <ListInsertRow
          open={showInsert}
          first={Boolean(firstRow)}
          onInsert={() => setShowInsert(!showInsert)}
        />
      )}
      {showInsert && (
        <ListCreateRow
          inline
          schema={schema}
          onCreate={(type: string) => {
            onCreate!(type)
            setShowInsert(false)
          }}
          onPaste={(data: ListRow) => {
            if (onPasteBlock) onPasteBlock(data)
            setShowInsert(false)
          }}
        />
      )}
      <Sink.Header>
        <Sink.Options style={{zIndex: 1}}>
          <IconButton
            icon={getType(type).icon || IcRoundDragHandle}
            {...handle}
            style={{cursor: handle ? 'grab' : 'grabbing'}}
            title="Drag and drop to reorder"
          />
        </Sink.Options>
        <Sink.Title>
          <TextLabel label={Type.label(type)} />
        </Sink.Title>
        <Sink.Options>
          {onCopyBlock !== undefined && (
            <IconButton
              icon={IcBaselineContentCopy}
              onClick={() => onCopyBlock()}
              title="Copy block"
            />
          )}
          {!readOnly && (
            <>
              <IconButton
                icon={IcRoundKeyboardArrowUp}
                onClick={() => onMove?.(-1)}
                title="Move up one position"
              />
              <IconButton
                icon={IcRoundKeyboardArrowDown}
                onClick={() => onMove?.(1)}
                title="Move down one position"
              />
              <IconButton icon={IcRoundClose} onClick={onDelete} title="Delete block" />
            </>
          )}
        </Sink.Options>
      </Sink.Header>
      <Sink.Content>
        <InputForm type={type} />
      </Sink.Content>
    </div>
  )
}

interface ListCreateRowProps {
  schema: Schema
  readOnly?: boolean
  inline?: boolean
  onCreate: (type: string, data?: ListRow) => void
  onPaste: (data: ListRow) => void
}

function ListCreateRow({
  schema,
  readOnly,
  inline,
  onCreate,
  onPaste
}: ListCreateRowProps) {
  const [pasted] = useAtom(copyAtom)
  const canPaste =
    pasted && entries(schema).some(([key]) => key === pasted._type)
  return (
    <div className={styles.create({inline})}>
      <Create.Root disabled={readOnly}>
        {entries(schema).map(([key, type]) => {
          return (
            <Create.Button
              icon={getType(type).icon}
              key={key}
              onClick={() => onCreate(key)}
            >
              <TextLabel label={Type.label(type)} />
            </Create.Button>
          )
        })}
        {canPaste && (
          <Create.Button
            icon={IcBaselineContentPasteGo}
            onClick={() => onPaste(pasted)}
            mod="paste"
          >
            <TextLabel label="Paste block" />
          </Create.Button>
        )}
      </Create.Root>
    </div>
  )
}

interface ListInsertRowProps {
  first: boolean
  open: boolean
  onInsert: () => void
}

function ListInsertRow({first, open, onInsert}: ListInsertRowProps) {
  return (
    <>
      <div className={styles.insert({open, first})}>
        <button className={styles.insert.icon()} onClick={onInsert} title="Insert new block">
          <Icon icon={open ? IcRoundKeyboardArrowUp : IcRoundAdd} />
        </button>
      </div>
    </>
  )
}

export interface ListInputProps {
  field: ListField<ListRow, ListRow, ListOptions<Schema>>
}

const layoutMeasuringConfig = {
  strategy: LayoutMeasuringStrategy.Always
}

export function ListInput({field}: ListInputProps) {
  const {options, value, mutator, error} = useField(field)
  const {schema, readOnly} = options
  const rows: Array<ListRow> = value as any
  const ids = rows.map(row => row._id)
  const [, setPasted] = useAtom(copyAtom)
  const [dragging, setDragging] = useState<ListRow | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const {active} = event
    setDragging(rows.find(row => row._id === active.id) || null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event
    if (!over || active.id === over.id) return

    if (!readOnly) mutator.move(ids.indexOf(active.id), ids.indexOf(over.id))
    setDragging(null)
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      layoutMeasuring={layoutMeasuringConfig}
    >
      <InputLabel {...options} error={error} icon={IcOutlineList}>
        <div className={styles.root()}>
          <div className={styles.root.inner({inline: options.inline})}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <Sink.Root>
                {rows.map((row, i) => {
                  const type = options.schema[row[ListRow.type]]
                  return (
                    <FormRow
                      key={row._id}
                      field={field}
                      rowId={row._id}
                      type={type}
                      readOnly={readOnly}
                    >
                      <ListInputRowSortable
                        row={row}
                        schema={schema}
                        readOnly={readOnly}
                        onCopyBlock={() => {
                          const data = mutator.read(row._id)
                          setPasted(data)
                        }}
                        onMove={direction => {
                          if (readOnly) return
                          mutator.move(i, i + direction)
                        }}
                        onDelete={() => {
                          if (readOnly) return
                          mutator.remove(row._id)
                        }}
                        onCreate={(type: string) => {
                          if (readOnly) return
                          mutator.push({_type: type} as any, i)
                        }}
                        onPasteBlock={(data: ListRow) => {
                          if (readOnly) return
                          const {_id, _index, ...rest} = data
                          mutator.push(rest, i)
                        }}
                        firstRow={i === 0}
                      />
                    </FormRow>
                  )
                })}
                <ListCreateRow
                  schema={schema}
                  readOnly={readOnly}
                  onPaste={(data: ListRow) => {
                    const {_id, _index, ...rest} = data
                    mutator.push(rest)
                  }}
                  onCreate={(type: string, data?: ListRow) => {
                    if (readOnly) return
                    mutator.push({_type: type} as any)
                  }}
                />
              </Sink.Root>
            </SortableContext>

            <DragOverlay
              dropAnimation={{
                ...defaultDropAnimation,
                dragSourceOpacity: 0.5
              }}
            >
              {dragging ? (
                <FormRow
                  key="overlay"
                  field={field}
                  rowId={dragging._id}
                  type={options.schema[dragging[ListRow.type]]}
                  readOnly={readOnly}
                >
                  <ListInputRow
                    key="overlay"
                    row={dragging}
                    schema={schema}
                    isDragOverlay
                  />
                </FormRow>
              ) : null}
            </DragOverlay>
          </div>
        </div>
      </InputLabel>
    </DndContext>
  )
}
