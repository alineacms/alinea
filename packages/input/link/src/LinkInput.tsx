import {Entry, Media, Outcome, Reference, Type, View} from '@alinea/core'
import {useReferencePicker, useSession, useWorkspace} from '@alinea/dashboard'
import {EntrySummaryRow} from '@alinea/dashboard/view/entry/EntrySummary'
import {Fields, InputLabel, InputState, useInput} from '@alinea/editor'
import {Expr} from '@alinea/store'
import {
  Card,
  Create,
  fromModule,
  HStack,
  IconButton,
  Typo,
  VStack
} from '@alinea/ui'
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

type LinkInputRowProps<T> = {
  fields: Type<T> | undefined
  state: InputState<T>
  reference: Reference
  entryData: (id: string) => Entry.Minimal | undefined
  onRemove: () => void
  isDragging?: boolean
  isDragOverlay?: boolean
  isSortable?: boolean
  handle?: DraggableSyntheticListeners
  rootRef?: Ref<HTMLDivElement>
} & HTMLAttributes<HTMLDivElement>

function LinkInputRow<T>({
  fields,
  state,
  reference,
  entryData,
  onRemove,
  handle,
  rootRef,
  isDragging,
  isDragOverlay,
  isSortable,
  ...rest
}: LinkInputRowProps<T>) {
  switch (reference.type) {
    case 'entry':
      const entry = entryData(reference.entry)
      return (
        <Card.Root ref={rootRef} {...rest}>
          <HStack
            gap={8}
            center
            className={styles.row({
              // dragging: isDragging,
              // overlay: isDragOverlay
            })}
          >
            {isSortable && (
              <div {...handle}>
                <IconButton
                  icon={MdDragHandle}
                  style={{cursor: handle ? 'grab' : 'grabbing'}}
                />
              </div>
            )}
            <div>
              {entry && <LinkInputEntryRow key={entry.id} entry={entry} />}
            </div>
            <div style={{marginLeft: 'auto'}}>
              <IconButton icon={MdDelete} onClick={onRemove} />
            </div>
          </HStack>
          {fields && (
            <Card.Content style={{paddingTop: 0}}>
              <Fields fields={fields.fields} state={state} />
            </Card.Content>
          )}
        </Card.Root>
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

function LinkInputRowSortable<T>(props: LinkInputRowProps<T>) {
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

function conditionOfType(type: LinkType) {
  switch (type) {
    case 'entry':
      return Entry.type.isNot(Media.Type.File)
    case 'image':
      return Entry.type
        .is(Media.Type.File)
        .and(Entry.get('extension').isIn(Media.imageExtensions))
    case 'file':
      return Entry.type
        .is(Media.Type.File)
        .and(Entry.get('extension').isNotIn(Media.imageExtensions))
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

export type LinkInputProps<T> = {
  state: InputState<InputState.List<Reference & T>>
  field: LinkField<T>
}

export function LinkInput<T>({state, field}: LinkInputProps<T>) {
  const {hub} = useSession()
  const [value, {push, move, remove}] = useInput(state)
  const {schema} = useWorkspace()
  const {pickLink} = useReferencePicker()
  const {fields, type, width, inline, optional, help, max} = field.options
  const types = Array.isArray(type) ? type : type ? [type] : []

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
      showUploader: types.includes('file') || types.includes('image'),
      max
    }).then(links => {
      const seen = new Set()
      if (!links) return
      for (const link of links) {
        seen.add(link.id)
        if (value.find(v => v.id === link.id)) continue
        push(link as Reference & T)
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
              <VStack gap={8}>
                {value.map(reference => {
                  return (
                    <LinkInputRowSortable<T>
                      key={reference.id}
                      fields={fields}
                      state={state.child(reference.id)}
                      entryData={id => data?.get(id)}
                      reference={reference}
                      onRemove={() => remove(reference.id)}
                      isSortable={max !== 1}
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
                <LinkInputRow<T>
                  fields={fields}
                  state={state.child(dragging.id)}
                  entryData={id => data?.get(id)}
                  reference={dragging}
                  onRemove={() => remove(dragging.id)}
                  isDragOverlay
                  isSortable={max !== 1}
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
