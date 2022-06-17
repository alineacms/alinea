import {Entry, Outcome, Reference, TypeConfig, View} from '@alinea/core'
import {useReferencePicker, useSession, useWorkspace} from '@alinea/dashboard'
import {EntrySummaryRow} from '@alinea/dashboard/view/entry/EntrySummary'
import {InputForm, InputLabel, InputState, useInput} from '@alinea/editor'
import {Expr} from '@alinea/store'
import {Card, Create, fromModule, IconButton, Typo} from '@alinea/ui'
import {IcRoundClose} from '@alinea/ui/icons/IcRoundClose'
import {IcRoundDragHandle} from '@alinea/ui/icons/IcRoundDragHandle'
import {IcRoundLink} from '@alinea/ui/icons/IcRoundLink'
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
  fields: TypeConfig<T> | undefined
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
        <div
          className={styles.row({
            dragging: isDragging,
            overlay: isDragOverlay
          })}
          ref={rootRef}
          {...rest}
        >
          <Card.Header>
            <Card.Options>
              {isSortable ? (
                <IconButton
                  icon={IcRoundDragHandle}
                  {...handle}
                  style={{cursor: handle ? 'grab' : 'grabbing'}}
                />
              ) : (
                <div className={styles.row.staticHandle()}>
                  <IcRoundLink />
                </div>
              )}
            </Card.Options>
            <div style={{flexGrow: 1}}>
              {entry && <LinkInputEntryRow key={entry.id} entry={entry} />}
            </div>
            <Card.Options>
              <IconButton icon={IcRoundClose} onClick={onRemove} />
            </Card.Options>
          </Card.Header>
          {fields && (
            <Card.Content>
              <InputForm type={fields} state={state} />
            </Card.Content>
          )}
        </div>
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

function restrictByType(
  type: LinkType | Array<LinkType> | undefined
): Expr<boolean> | undefined {
  if (!type || (Array.isArray(type) && type.length === 0)) return undefined
  let condition = Expr.value(false)
  for (const t of Array.isArray(type) ? type : [type]) {
    condition = condition.or(LinkType.conditionOf(Entry, t))
  }
  return condition
}

export type LinkInputProps<T> = {
  state: InputState<InputState.List<Reference & T>>
  field: LinkField<T, any>
}

export function LinkInput<T>({state, field}: LinkInputProps<T>) {
  const {hub} = useSession()
  const [value = [], {push, move, remove}] = useInput(state)
  const {schema} = useWorkspace()
  const picker = useReferencePicker()
  const {
    fields,
    type,
    width,
    inline,
    condition,
    multiple,
    optional,
    help,
    max = !multiple ? 1 : undefined
  } = field.options
  const types = Array.isArray(type) ? type : type ? [type] : []
  const cursor = useMemo(() => {
    const entries = value
      .filter((v: Reference): v is Reference.Entry => v.type === 'entry')
      .map(v => v.entry)
    return Entry.where(Entry.id.isIn(entries))
  }, [value, schema])

  const {data, isLoading} = useQuery(
    ['explorer', cursor],
    () => {
      const selection = View.getSelection(schema, 'summaryRow', Entry)
      if (value.length === 0) return new Map()
      return hub
        .query({
          cursor: cursor.select(
            Entry.type.case(selection, EntrySummaryRow.selection(Entry))
          )
        })
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
    const conditions = [condition, restrictByType(type)]
      .filter(Boolean)
      .reduce((a, b) => (a ? a.and(b!) : b), undefined)
    return picker
      .pickLink({
        selection: value,
        condition: conditions,
        defaultView: type === 'image' ? 'thumb' : 'row',
        showUploader: types.includes('file') || types.includes('image'),
        max
      })
      .then(links => {
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
  const showExternal = types.includes('external')

  return (
    <>
      <picker.Modal />
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
          icon={IcRoundLink}
        >
          <div className={styles.root()}>
            <div className={styles.root.inner()}>
              <SortableContext
                items={ids}
                strategy={verticalListSortingStrategy}
              >
                <Card.Root>
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

                  {showLinkPicker && (
                    <div className={styles.create()}>
                      <Create.Root>
                        <Create.Button onClick={handleCreate}>
                          Pick link
                        </Create.Button>
                        {showExternal && (
                          <Create.Button onClick={handleCreate}>
                            External url
                          </Create.Button>
                        )}
                      </Create.Root>
                    </div>
                  )}
                </Card.Root>
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
            </div>
          </div>
        </InputLabel>
      </DndContext>
    </>
  )
}
