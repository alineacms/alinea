import {
  closestCenter,
  defaultDropAnimation,
  DndContext,
  DragEndEvent,
  DraggableSyntheticListeners,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  LayoutMeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  AnimateLayoutChanges,
  defaultAnimateLayoutChanges,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {CSS, FirstArgument} from '@dnd-kit/utilities'
import {ListField} from 'alinea/core/field/ListField'
import {Schema} from 'alinea/core/Schema'
import {ListRow} from 'alinea/core/shape/ListShape'
import {Type} from 'alinea/core/Type'
import {entries} from 'alinea/core/util/Objects'
import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useField} from 'alinea/dashboard/editor/UseField'
import {Create} from 'alinea/dashboard/view/Create'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {fromModule, Icon, TextLabel} from 'alinea/ui'
import {IcOutlineList} from 'alinea/ui/icons/IcOutlineList'
import IcRoundAdd from 'alinea/ui/icons/IcRoundAdd'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundDragHandle} from 'alinea/ui/icons/IcRoundDragHandle'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowUp} from 'alinea/ui/icons/IcRoundKeyboardArrowUp'
import {Sink} from 'alinea/ui/Sink'
import {
  CSSProperties,
  HTMLAttributes,
  PropsWithChildren,
  Ref,
  useState
} from 'react'
import {ListOptions} from './ListField.js'
import css from './ListField.module.scss'

const styles = fromModule(css)

function animateLayoutChanges(args: FirstArgument<AnimateLayoutChanges>) {
  const {isSorting, wasSorting} = args
  if (isSorting || wasSorting) return defaultAnimateLayoutChanges(args)
  return true
}

function ListInputRowSortable(props: ListInputRowProps) {
  const {onCreate} = props
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
    handle?: DraggableSyntheticListeners
    // React ts types force our hand here since it's a generic component,
    // and forwardRef does not forward generics.
    // There's probably an issue for this on DefinitelyTyped.
    rootRef?: Ref<HTMLDivElement>
    isDragOverlay?: boolean
    onCreate?: (type: string) => void
    firstRow?: boolean
  } & HTMLAttributes<HTMLDivElement>
>

function ListInputRow({
  row,
  schema,
  onMove,
  onDelete,
  handle,
  rootRef,
  isDragging,
  isDragOverlay,
  readOnly,
  onCreate,
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
        />
      )}
      <Sink.Header>
        <Sink.Options style={{zIndex: 1}}>
          <IconButton
            icon={Type.meta(type).icon || IcRoundDragHandle}
            {...handle}
            style={{cursor: handle ? 'grab' : 'grabbing'}}
          />
        </Sink.Options>
        <Sink.Title>
          <TextLabel label={Type.label(type)} />
        </Sink.Title>
        {!readOnly && (
          <Sink.Options>
            <IconButton
              icon={IcRoundKeyboardArrowUp}
              onClick={() => onMove?.(-1)}
            />
            <IconButton
              icon={IcRoundKeyboardArrowDown}
              onClick={() => onMove?.(1)}
            />
            <IconButton icon={IcRoundClose} onClick={onDelete} />
          </Sink.Options>
        )}
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
  onCreate: (type: string) => void
}

function ListCreateRow({
  schema,
  readOnly,
  inline,
  onCreate
}: ListCreateRowProps) {
  return (
    <div className={styles.create({inline})}>
      <Create.Root disabled={readOnly}>
        {entries(schema).map(([key, type]) => {
          return (
            <Create.Button
              icon={Type.meta(type).icon}
              key={key}
              onClick={() => onCreate(key)}
            >
              <TextLabel label={Type.label(type)} />
            </Create.Button>
          )
        })}
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
        <button className={styles.insert.icon()} onClick={onInsert}>
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
                        firstRow={i === 0}
                      />
                    </FormRow>
                  )
                })}
                <ListCreateRow
                  schema={schema}
                  readOnly={readOnly}
                  onCreate={(type: string) => {
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
