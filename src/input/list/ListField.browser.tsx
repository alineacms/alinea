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
import {Field, Infer, Schema, Type} from 'alinea/core'
import {ListField} from 'alinea/core/field/ListField'
import {entries} from 'alinea/core/util/Objects'
import {Create} from 'alinea/dashboard/view/Create'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputForm, InputLabel, InputState, useInput} from 'alinea/editor'
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
import {list as createList, ListOptions, ListRow} from './ListField.js'
import css from './ListInput.module.scss'
export * from './ListField.js'

export const list = Field.provideView(ListInput, createList)

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
      id: props.row.id
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
    path: InputState<ListRow>
    field: ListField<Infer<Schema>, ListOptions<Schema>>
    isDragging?: boolean
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
  field,
  path,
  onMove,
  onDelete,
  handle,
  rootRef,
  isDragging,
  isDragOverlay,
  onCreate,
  firstRow,
  ...rest
}: ListInputRowProps) {
  const {label, options} = field[Field.Data]
  const type = options.schema[row.type]
  const [showInsert, setShowInsert] = useState(false)
  if (!type) return null
  return (
    <div
      className={styles.row({dragging: isDragging, overlay: isDragOverlay})}
      ref={rootRef}
      {...rest}
    >
      {!isDragOverlay && (
        <ListInsertRow
          open={showInsert}
          first={Boolean(firstRow)}
          onInsert={() => setShowInsert(!showInsert)}
        />
      )}
      {showInsert && (
        <ListCreateRow
          inline
          field={field}
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
      </Sink.Header>
      <Sink.Content>
        <InputForm type={type} state={path} />
      </Sink.Content>
    </div>
  )
}

interface ListCreateRowProps {
  field: ListField<Infer<Schema>, ListOptions<Schema>>
  inline?: boolean
  onCreate: (type: string) => void
}

function ListCreateRow({field, inline, onCreate}: ListCreateRowProps) {
  const schema = field[Field.Data].options.schema
  return (
    <div className={styles.create({inline})}>
      <Create.Root>
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
  state: InputState<InputState.List<any>>
  field: ListField<Infer<Schema>, ListOptions<Schema>>
}

const layoutMeasuringConfig = {
  strategy: LayoutMeasuringStrategy.Always
}

export function ListInput({state, field}: ListInputProps) {
  const {label, options} = field[Field.Data]
  const [value, list] = useInput(state)
  const rows: Array<ListRow> = value as any
  const ids = rows.map(row => row.id)
  const [dragging, setDragging] = useState<ListRow | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const {active} = event
    setDragging(rows.find(row => row.id === active.id) || null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event
    if (!over || active.id === over.id) return
    list.move(ids.indexOf(active.id), ids.indexOf(over.id))
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
      <InputLabel label={label} {...options} icon={IcOutlineList}>
        <div className={styles.root()}>
          <div className={styles.root.inner({inline: options.inline})}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <Sink.Root>
                {rows.map((row, i) => {
                  return (
                    <ListInputRowSortable
                      key={row.id}
                      row={row}
                      field={field}
                      path={state.child(row.id)}
                      onMove={direction => list.move(i, i + direction)}
                      onDelete={() => list.remove(row.id)}
                      onCreate={(type: string) => {
                        list.push({type} as any, i)
                      }}
                      firstRow={i === 0}
                    />
                  )
                })}
                <ListCreateRow
                  field={field}
                  onCreate={(type: string) => {
                    list.push({type} as any)
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
                <ListInputRow
                  key="overlay"
                  row={dragging}
                  field={field}
                  path={state.child(dragging.id)}
                  isDragOverlay
                />
              ) : null}
            </DragOverlay>
          </div>
        </div>
      </InputLabel>
    </DndContext>
  )
}
