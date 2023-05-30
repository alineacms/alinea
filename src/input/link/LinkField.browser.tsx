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
import {Field, Reference, Type} from 'alinea/core'
import {Create} from 'alinea/dashboard/view/Create'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputForm, InputLabel, InputState, useInput} from 'alinea/editor'
import {Picker} from 'alinea/editor/Picker'
import {Card, fromModule, TextLabel} from 'alinea/ui'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundDragHandle} from 'alinea/ui/icons/IcRoundDragHandle'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'
import {
  CSSProperties,
  HTMLAttributes,
  Ref,
  Suspense,
  useMemo,
  useState
} from 'react'
import {linkConstructors} from './LinkConstructors.js'
import {createLink, LinkField} from './LinkField.js'
import css from './LinkInput.module.scss'

export * from './LinkField.js'

const createLinkInput = Field.provideView(LinkInput, createLink)

/** Create a link field configuration */
export const link = linkConstructors(createLinkInput)

const styles = fromModule(css)

interface LinkInputRowProps<T> extends HTMLAttributes<HTMLDivElement> {
  picker: Picker
  fields: Type<T> | undefined
  state: InputState<T>
  reference: Reference
  onRemove: () => void
  isDragging?: boolean
  isDragOverlay?: boolean
  isSortable?: boolean
  handle?: DraggableSyntheticListeners
  rootRef?: Ref<HTMLDivElement>
}

function LinkInputRow<T>({
  picker,
  fields,
  state,
  reference,
  onRemove,
  handle,
  rootRef,
  isDragging,
  isDragOverlay,
  isSortable,
  ...rest
}: LinkInputRowProps<T>) {
  const RowView = picker.viewRow!
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
        <div style={{flexGrow: 1, minWidth: 0}}>
          <Suspense fallback={null}>
            <RowView reference={reference} />
          </Suspense>
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

export interface LinkInputProps<Row> {
  state: InputState<InputState.List<Reference>>
  field: LinkField<Row>
}

export function LinkInput<T>({state, field}: LinkInputProps<T>) {
  const {label, options} = field[Field.Data]
  const [value = [], list] = useInput(state)
  const {
    fields,
    width,
    inline,
    multiple,
    optional,
    help,
    max = !multiple ? 1 : undefined
  } = options
  const pickers = options.pickers || []
  const picker = useMemo(() => {
    const res = new Map()
    for (const p of pickers) res.set(p.type, p)
    return res
  }, [pickers])

  const [pickFrom, setPickFrom] = useState<Picker | undefined>()

  function handleConfirm(links: Array<Reference>) {
    if (!pickFrom || !links) return
    const seen = new Set()
    for (const link of links) {
      if (link.type !== pickFrom.type) continue
      seen.add(link.id)
      if (pickFrom.handlesMultiple) {
        const index = value.findIndex(v => v.id === link.id)
        if (index > -1) list.replace(link.id, link)
        else list.push(link)
      } else {
        list.push(link)
      }
    }
    if (pickFrom.handlesMultiple)
      for (const link of value) {
        if (link.type !== pickFrom.type) continue
        if (seen.has(link.id)) continue
        list.remove(link.id)
      }
    setPickFrom(undefined)
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
    list.move(ids.indexOf(active.id), ids.indexOf(over.id))
    setDragging(null)
  }

  const showLinkPicker = max ? value.length < max : true

  const PickerView = pickFrom && pickFrom.view!

  return (
    <>
      {PickerView && (
        <PickerView
          type={pickFrom.type}
          options={pickFrom.options}
          selection={value.filter(ref => ref.type === pickFrom.type)}
          onConfirm={handleConfirm}
          onCancel={() => setPickFrom(undefined)}
        />
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        layoutMeasuring={layoutMeasuringConfig}
      >
        <InputLabel
          label={label}
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
                        picker={picker.get(reference.type)}
                        reference={reference}
                        onRemove={() => list.remove(reference.id)}
                        isSortable={max !== 1}
                      />
                    )
                  })}

                  {showLinkPicker && (
                    <div className={styles.create()}>
                      <Create.Root>
                        {pickers.map((picker, i) => {
                          return (
                            <Create.Button
                              key={i}
                              onClick={() => setPickFrom(picker)}
                            >
                              <TextLabel label={picker.label} />
                            </Create.Button>
                          )
                        })}
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
                    picker={picker.get(dragging.type)}
                    reference={dragging}
                    onRemove={() => list.remove(dragging.id)}
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
