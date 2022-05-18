import {LazyRecord} from '@alinea/core/util/LazyRecord'
import {InputForm, InputLabel, InputState, useInput} from '@alinea/editor'
import {Card, Create, fromModule, IconButton, TextLabel} from '@alinea/ui'
import {IcOutlineList} from '@alinea/ui/icons/IcOutlineList'
import {IcRoundClose} from '@alinea/ui/icons/IcRoundClose'
import {IcRoundDragHandle} from '@alinea/ui/icons/IcRoundDragHandle'
import {IcRoundKeyboardArrowDown} from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowUp} from '@alinea/ui/icons/IcRoundKeyboardArrowUp'
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
import {
  CSSProperties,
  HTMLAttributes,
  PropsWithChildren,
  Ref,
  useState
} from 'react'
import {ListField, ListRow} from './ListField'
import css from './ListInput.module.scss'

const styles = fromModule(css)

function animateLayoutChanges(args: FirstArgument<AnimateLayoutChanges>) {
  const {isSorting, wasSorting} = args
  if (isSorting || wasSorting) return defaultAnimateLayoutChanges(args)
  return true
}

function ListInputRowSortable<T extends ListRow>(props: ListInputRowProps<T>) {
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
    />
  )
}

type ListInputRowProps<T extends ListRow> = PropsWithChildren<
  {
    row: T
    path: InputState<T>
    field: ListField<T>
    isDragging?: boolean
    onMove?: (direction: 1 | -1) => void
    onDelete?: () => void
    handle?: DraggableSyntheticListeners
    // React ts types force our hand here since it's a generic component,
    // and forwardRef does not forward generics.
    // There's probably an issue for this on DefinitelyTyped.
    rootRef?: Ref<HTMLDivElement>
    isDragOverlay?: boolean
  } & HTMLAttributes<HTMLDivElement>
>

function ListInputRow<T extends ListRow>({
  row,
  field,
  path,
  onMove,
  onDelete,
  handle,
  rootRef,
  isDragging,
  isDragOverlay,
  ...rest
}: ListInputRowProps<T>) {
  const type = LazyRecord.get(field.options.schema.types, row.type)
  if (!type) return null
  return (
    <div
      className={styles.row({dragging: isDragging, overlay: isDragOverlay})}
      ref={rootRef}
      {...rest}
    >
      <Card.Header>
        <Card.Options>
          <IconButton
            icon={type.options.icon || IcRoundDragHandle}
            {...handle}
            style={{cursor: handle ? 'grab' : 'grabbing'}}
          />
        </Card.Options>
        <Card.Title>
          <TextLabel label={type.label} />
        </Card.Title>
        <Card.Options>
          <IconButton
            icon={IcRoundKeyboardArrowUp}
            onClick={() => onMove?.(-1)}
          />
          <IconButton
            icon={IcRoundKeyboardArrowDown}
            onClick={() => onMove?.(1)}
          />
          <IconButton icon={IcRoundClose} onClick={onDelete} />
        </Card.Options>
      </Card.Header>
      <Card.Content>
        <InputForm type={type} state={path} />
      </Card.Content>
    </div>
  )
}

type ListCreateRowProps<T> = {
  field: ListField<T>
  onCreate: (type: string) => void
}

function ListCreateRow<T>({field, onCreate}: ListCreateRowProps<T>) {
  const {types} = field.options.schema
  return (
    <div className={styles.create()}>
      <Create.Root>
        {LazyRecord.iterate(types).map(([key, type]) => {
          return (
            <Create.Button
              icon={type.options.icon}
              key={key}
              onClick={() => onCreate(key)}
            >
              <TextLabel label={type.label} />
            </Create.Button>
          )
        })}
      </Create.Root>
    </div>
  )
}

export type ListInputProps<T> = {
  state: InputState<InputState.List<T>>
  field: ListField<T>
}
const layoutMeasuringConfig = {
  strategy: LayoutMeasuringStrategy.Always
}
export function ListInput<T extends ListRow>({
  state,
  field
}: ListInputProps<T>) {
  const [rows, list] = useInput(state)
  const {help, inline, width, optional} = field.options
  const ids = rows.map(row => row.id)
  const [dragging, setDragging] = useState<T | null>(null)
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
      <InputLabel
        label={field.label}
        help={help}
        optional={optional}
        inline={inline}
        width={width}
        icon={IcOutlineList}
      >
        <div className={styles.root()}>
          <div className={styles.root.inner({inline})}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <Card.Root>
                {rows.map((row, i) => {
                  return (
                    <ListInputRowSortable<T>
                      key={row.id}
                      row={row}
                      field={field}
                      path={state.child(row.id)}
                      onMove={direction => list.move(i, i + direction)}
                      onDelete={() => list.remove(row.id)}
                    />
                  )
                })}
                <ListCreateRow
                  onCreate={(type: string) => {
                    list.push({type} as any)
                  }}
                  field={field}
                />
              </Card.Root>
            </SortableContext>

            <DragOverlay
              dropAnimation={{
                ...defaultDropAnimation,
                dragSourceOpacity: 0.5
              }}
            >
              {dragging ? (
                <ListInputRow<T>
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
