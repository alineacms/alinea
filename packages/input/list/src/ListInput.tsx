import {inputPath, InputPath} from '@alinea/core'
import {Fields, Label, useInput} from '@alinea/editor'
import {fromModule, IconButton, TextLabel} from '@alinea/ui'
import {Create} from '@alinea/ui/Create'
import {HStack, VStack} from '@alinea/ui/Stack'
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
import {MdDelete, MdDragHandle} from 'react-icons/md/index'
import {ListField} from './ListField'
import css from './ListInput.module.scss'

const styles = fromModule(css)

export type ListRow = {
  $id: string
  $index: string
  $channel: string
}

type ListInputRowProps<T extends ListRow> = PropsWithChildren<
  {
    row: T
    path: InputPath<T>
    field: ListField<T>
    isDragging?: boolean
    onDelete?: () => void
    handle?: DraggableSyntheticListeners
    // React ts types force our hand here since it's a generic component,
    // and forwardRef does not forward generics.
    // There's probably an issue for this on DefinitelyTyped.
    rootRef?: Ref<HTMLDivElement>
  } & HTMLAttributes<HTMLDivElement>
>

function animateLayoutChanges(args: FirstArgument<AnimateLayoutChanges>) {
  const {isSorting, wasSorting} = args
  if (isSorting || wasSorting) return defaultAnimateLayoutChanges(args)
  return true
}

function ListInputRowSortable<T extends ListRow>(props: ListInputRowProps<T>) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({
      animateLayoutChanges,
      id: props.row.$id
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

function ListInputRow<T extends ListRow>({
  row,
  field,
  path,
  onDelete,
  handle,
  rootRef,
  isDragging,
  ...rest
}: ListInputRowProps<T>) {
  const channel = field.options.schema.channel(row.$channel)
  if (!channel) return null
  return (
    <div
      className={styles.row.is({dragging: isDragging})()}
      ref={rootRef}
      {...rest}
    >
      <HStack gap={10}>
        <IconButton
          icon={MdDragHandle}
          {...handle}
          style={{cursor: handle ? 'grab' : 'grabbing'}}
        />
        <div style={{flexGrow: 1}}>
          <Fields channel={channel as any} path={path} />
        </div>
        <IconButton icon={MdDelete} onClick={onDelete} />
      </HStack>
    </div>
  )
}

type ListCreateRowProps<T> = {
  field: ListField<T>
  onCreate: (channel: string) => void
}

function ListCreateRow<T>({field, onCreate}: ListCreateRowProps<T>) {
  const channels = Array.from(field.options.schema)
  return (
    <Create.Root>
      {channels.map(([key, channel]) => {
        return (
          <Create.Button key={key} onClick={() => onCreate(key)}>
            <TextLabel label={channel.label} />
          </Create.Button>
        )
      })}
    </Create.Root>
  )
}

export type ListInputProps<T> = {
  path: InputPath<Array<T>>
  field: ListField<T>
}
const layoutMeasuringConfig = {
  strategy: LayoutMeasuringStrategy.Always
}
export function ListInput<T extends ListRow>({path, field}: ListInputProps<T>) {
  const [rows, input] = useInput(path, field.value)
  const {help} = field.options
  const ids = rows.map(row => row.$id)
  const [dragging, setDragging] = useState<T | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const {active} = event
    setDragging(rows.find(row => row.$id === active.id) || null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event
    if (!over || active.id === over.id) return
    input.move(ids.indexOf(active.id), ids.indexOf(over.id))
    setDragging(null)
  }

  return (
    <Label label={field.label} help={help}>
      <div className={styles.root()}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          layoutMeasuring={layoutMeasuringConfig}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <VStack gap={10}>
              {rows.map(row => {
                return (
                  <ListInputRowSortable<T>
                    key={row.$id}
                    row={row}
                    field={field}
                    path={inputPath<T>(path.concat(row.$id))}
                    onDelete={() => input.delete(row.$id)}
                  />
                )
              })}
            </VStack>
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
                path={inputPath<T>(path.concat(dragging.$id))}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      <ListCreateRow
        onCreate={(channel: string) => {
          input.push({
            $channel: channel
          })
        }}
        field={field}
      />
    </Label>
  )
}
