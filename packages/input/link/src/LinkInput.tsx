import {Entry, Media, Outcome, Reference, View} from '@alinea/core'
import {useReferencePicker, useSession, useWorkspace} from '@alinea/dashboard'
import {EntrySummaryRow} from '@alinea/dashboard/view/entry/EntrySummary'
import {InputLabel, InputState, useInput} from '@alinea/editor'
import {Expr} from '@alinea/store'
import {Create, fromModule, HStack, IconButton, Typo} from '@alinea/ui'
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
import {CSSProperties, HTMLAttributes, Ref, useMemo, useState} from 'react'
import {MdDelete, MdDragHandle, MdLink} from 'react-icons/md'
import {useQuery} from 'react-query'
import {LinkField, LinkType} from './LinkField'
import css from './LinkInput.module.scss'

const styles = fromModule(css)

type LinkInputEntryRowProps = {
  entry: Entry.Minimal
}

function LinkInputEntryRow({entry}: LinkInputEntryRowProps) {
  const {schema} = useWorkspace()
  const type = schema.type(entry.type)
  const View: any = type?.options.summaryRow || EntrySummaryRow
  return <View key={entry.id} {...entry} />
}

type LinkInputRowProps = {
  reference: Reference
  entryData: (id: string) => Entry.Minimal | undefined
  onRemove: () => void
  isDragging?: boolean
  isDragOverlay?: boolean
  isSortable?: boolean
  handle?: DraggableSyntheticListeners
  rootRef?: Ref<HTMLDivElement>
} & HTMLAttributes<HTMLDivElement>

function LinkInputRow({
  reference,
  entryData,
  onRemove,
  handle,
  rootRef,
  isDragging,
  isDragOverlay,
  isSortable,
  ...rest
}: LinkInputRowProps) {
  switch (reference.type) {
    case 'entry':
      const entry = entryData(reference.entry)
      return (
        <HStack
          gap={8}
          center
          className={styles.row({dragging: isDragging, overlay: isDragOverlay})}
          ref={rootRef}
          {...rest}
        >
          {isSortable && (
            <div {...handle}>
              <IconButton
                icon={MdDragHandle}
                style={{cursor: handle ? 'grab' : 'grabbing'}}
              />
            </div>
          )}
          {entry && <LinkInputEntryRow key={entry.id} entry={entry} />}
          <div>
            <IconButton icon={MdDelete} onClick={onRemove} />
          </div>
        </HStack>
      )

    case 'url':
      return <Typo.Monospace>Todo: url preview</Typo.Monospace>
  }
}

function animateLayoutChanges(args: FirstArgument<AnimateLayoutChanges>) {
  const {isSorting, wasSorting} = args
  if (isSorting || wasSorting) return defaultAnimateLayoutChanges(args)
  return true
}

function LinkInputRowSortable(props: LinkInputRowProps) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({
      animateLayoutChanges,
      id: props.reference.id
    })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined
  }

  return (
    <LinkInputRow
      {...props}
      rootRef={setNodeRef}
      style={style}
      handle={listeners}
      {...attributes}
      isDragging={isDragging}
    />
  )
}

const layoutMeasuringConfig = {
  strategy: LayoutMeasuringStrategy.Always
}

const imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']

function conditionOfType(type: LinkType) {
  switch (type) {
    case 'entry':
      return Entry.type.isNot(Media.Type.File)
    case 'image':
      return Entry.type
        .is(Media.Type.File)
        .and(Entry.get('extension').isIn(imageFormats))
    case 'file':
      return Entry.type
        .is(Media.Type.File)
        .and(Entry.get('extension').isNotIn(imageFormats))
    case 'external':
      return Expr.value(true)
  }
}

function restrictByType(
  type: LinkType | Array<LinkType> | undefined
): Expr<boolean> | undefined {
  if (!type || (Array.isArray(type) && type.length === 0)) return undefined
  let condition = Expr.value(false)
  for (const t of Array.isArray(type) ? type : [type]) {
    condition = condition.or(conditionOfType(t))
  }
  return condition
}

export type LinkInputProps = {
  state: InputState<Array<Reference>>
  field: LinkField
}

export function LinkInput({state, field}: LinkInputProps) {
  const {hub} = useSession()
  const [value, {push, move, remove}] = useInput(state)
  const {schema} = useWorkspace()
  const {pickLink} = useReferencePicker()
  const {type, width, inline, optional, help, max} = field.options

  const cursor = useMemo(() => {
    const entries = value
      .filter((v): v is Reference.Entry => v.type === 'entry')
      .map(v => v.entry)
    return Entry.where(Entry.id.isIn(entries))
  }, [value])

  const {data, isLoading} = useQuery(
    ['explorer', schema, cursor],
    () => {
      const selection = View.getSelection(schema, 'summaryRow', Entry)
      return hub
        .query(
          cursor.select(
            Entry.type.case(selection, EntrySummaryRow.selection(Entry))
          )
        )
        .then(Outcome.unpack)
        .then(entries => {
          const res = new Map()
          for (const entry of entries) res.set(entry.id, entry)
          return res
        })
    },
    {keepPreviousData: true}
  )

  function handleCreate() {
    return pickLink({
      selection: value,
      condition: restrictByType(type),
      defaultView: type === 'image' ? 'thumb' : 'row',
      max
    }).then(links => {
      const seen = new Set()
      if (!links) return
      for (const link of links) {
        seen.add(link.id)
        if (value.find(v => v.id === link.id)) continue
        push(link)
      }
      for (const link of value) {
        if (seen.has(link.id)) continue
        remove(link.id)
      }
    })
  }

  const ids = value.map(row => row.id)

  const [dragging, setDragging] = useState<Reference | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const {active} = event
    setDragging(value.find(row => row.id === active.id) || null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event
    if (!over || active.id === over.id) return
    move(ids.indexOf(active.id), ids.indexOf(over.id))
    setDragging(null)
  }

  const showLinkPicker = max ? value.length < max : true

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
        icon={MdLink}
      >
        <div className={styles.root()}>
          <div className={styles.root.inner()}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {value.map(reference => {
                return (
                  <LinkInputRowSortable
                    key={reference.id}
                    entryData={id => data?.get(id)}
                    reference={reference}
                    onRemove={() => remove(reference.id)}
                    isSortable={max !== 1}
                  />
                )
              })}
            </SortableContext>

            <DragOverlay
              dropAnimation={{
                ...defaultDropAnimation,
                dragSourceOpacity: 0.5
              }}
            >
              {dragging ? (
                <LinkInputRow
                  entryData={id => data?.get(id)}
                  reference={dragging}
                  onRemove={() => remove(dragging.id)}
                  isDragOverlay
                />
              ) : null}
            </DragOverlay>
            {showLinkPicker && (
              <Create.Root>
                <Create.Button onClick={handleCreate}>Pick link</Create.Button>
              </Create.Root>
            )}
          </div>
        </div>
      </InputLabel>
    </DndContext>
  )
}
