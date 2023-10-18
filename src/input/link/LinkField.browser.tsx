import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DraggableSyntheticListeners,
  KeyboardSensor,
  LayoutMeasuringStrategy,
  PointerSensor,
  closestCenter,
  defaultDropAnimation,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  AnimateLayoutChanges,
  SortableContext,
  defaultAnimateLayoutChanges,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {CSS, FirstArgument} from '@dnd-kit/utilities'
import {Field, Reference, Type} from 'alinea/core'
import {entries} from 'alinea/core/util/Objects'
import {Create} from 'alinea/dashboard/view/Create'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputForm, InputLabel, InputState, useInput} from 'alinea/editor'
import {TextLabel, fromModule} from 'alinea/ui'
import {Sink} from 'alinea/ui/Sink'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import IcRoundDragHandle from 'alinea/ui/icons/IcRoundDragHandle'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'
import {CSSProperties, HTMLAttributes, Ref, Suspense, useState} from 'react'
import {Picker} from '../../editor/Picker.js'
import {
  LinkField,
  LinksField,
  createLink as createLinkField,
  createLinks as createLinksField
} from './LinkField.js'
import css from './LinkInput.module.scss'

const styles = fromModule(css)

export const createLink = Field.provideView(LinkInput, createLinkField)
export const createLinks = Field.provideView(LinksInput, createLinksField)

interface LinkInputProps<Row extends Reference> {
  state: InputState<InputState.Union<Reference>>
  field: LinkField<Row>
}

function LinkInput<Row extends Reference>({state, field}: LinkInputProps<Row>) {
  const {label, options} = field[Field.Data]
  const [value, union] = useInput(state)
  const {width, inline, optional, help} = options

  const [pickFrom, setPickFrom] = useState<string | undefined>()
  const picker = pickFrom ? options.pickers[pickFrom] : undefined

  function handleConfirm(link: Array<Reference>) {
    const selected = link[0]
    if (!pickFrom || !picker || !selected) return
    union.replace(selected)
    setPickFrom(undefined)
  }

  const PickerView = picker && picker.view!

  return (
    <>
      {PickerView && (
        <PickerView
          type={pickFrom!}
          options={picker.options}
          selection={[value]}
          onConfirm={handleConfirm}
          onCancel={() => setPickFrom(undefined)}
        />
      )}
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
            <Sink.Root>
              {value && options.pickers[value.type] ? (
                <LinkInputRow<Row>
                  fields={options.pickers[value.type].fields}
                  state={state as any}
                  picker={options.pickers[value.type]}
                  reference={value as Row}
                  onRemove={() => union.replace(undefined)}
                />
              ) : (
                <div className={styles.create()}>
                  <Create.Root>
                    {entries(options.pickers).map(([name, picker]) => {
                      return (
                        <Create.Button
                          key={name}
                          onClick={() => setPickFrom(name)}
                        >
                          <TextLabel label={picker.label} />
                        </Create.Button>
                      )
                    })}
                  </Create.Root>
                </div>
              )}
            </Sink.Root>
          </div>
        </div>
      </InputLabel>
    </>
  )
}

const layoutMeasuringConfig = {
  strategy: LayoutMeasuringStrategy.Always
}

interface LinksInputProps<Row extends Reference> {
  state: InputState<InputState.List<Reference>>
  field: LinksField<Row>
}

function LinksInput<Row extends Reference>({
  state,
  field
}: LinksInputProps<Row>) {
  const {label, options} = field[Field.Data]
  const [value = [], list] = useInput(state)
  const {width, inline, optional, help} = options

  const [pickFrom, setPickFrom] = useState<string | undefined>()
  const picker = pickFrom ? options.pickers[pickFrom] : undefined

  function handleConfirm(links: Array<Reference>) {
    if (!pickFrom || !picker || !links) return
    const seen = new Set()
    for (const link of links) {
      if (link.type !== pickFrom) continue
      seen.add(link.id)
      if (picker.handlesMultiple) {
        const index = value.findIndex(v => v.id === link.id)
        if (index > -1) list.replace(link.id, link)
        else list.push(link)
      } else {
        list.push(link)
      }
    }
    if (picker.handlesMultiple)
      for (const link of value) {
        if (link.type !== pickFrom) continue
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

  const showLinkPicker = options.max ? value.length < options.max : true

  const PickerView = picker && picker.view!

  return (
    <>
      {PickerView && (
        <PickerView
          type={pickFrom!}
          options={picker.options}
          selection={value.filter(ref => ref.type === pickFrom)}
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
                <Sink.Root>
                  {value.map(reference => {
                    if (!options.pickers[reference.type]) return null
                    return (
                      <LinkInputRowSortable<Row>
                        key={reference.id}
                        fields={options.pickers[reference.type].fields}
                        state={state.child(reference.id)}
                        picker={options.pickers[reference.type]}
                        reference={reference as Row}
                        onRemove={() => list.remove(reference.id)}
                        isSortable={options.max !== 1}
                      />
                    )
                  })}

                  {showLinkPicker && (
                    <div className={styles.create()}>
                      <Create.Root>
                        {entries(options.pickers).map(([name, picker]) => {
                          return (
                            <Create.Button
                              key={name}
                              onClick={() => setPickFrom(name)}
                            >
                              <TextLabel label={picker.label} />
                            </Create.Button>
                          )
                        })}
                      </Create.Root>
                    </div>
                  )}
                </Sink.Root>
              </SortableContext>

              <DragOverlay
                dropAnimation={{
                  ...defaultDropAnimation,
                  dragSourceOpacity: 0.5
                }}
              >
                {dragging && options.pickers[dragging.type] ? (
                  <LinkInputRow<Row>
                    fields={options.pickers[dragging.type].fields}
                    state={state.child(dragging.id)}
                    picker={options.pickers[dragging.type]}
                    reference={dragging as Row}
                    onRemove={() => list.remove(dragging.id)}
                    isDragOverlay
                    isSortable={options.max !== 1}
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

function animateLayoutChanges(args: FirstArgument<AnimateLayoutChanges>) {
  const {isSorting, wasSorting} = args
  if (isSorting || wasSorting) return defaultAnimateLayoutChanges(args)
  return true
}

function LinkInputRowSortable<Row extends Reference>(
  props: LinkInputRowProps<Row>
) {
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

interface LinkInputRowProps<Row extends Reference>
  extends HTMLAttributes<HTMLDivElement> {
  picker: Picker<Row>
  fields: Type<Row> | undefined
  state: InputState<Row>
  reference: Row
  onRemove: () => void
  isDragging?: boolean
  isDragOverlay?: boolean
  isSortable?: boolean
  handle?: DraggableSyntheticListeners
  rootRef?: Ref<HTMLDivElement>
}

function LinkInputRow<Row extends Reference>({
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
}: LinkInputRowProps<Row>) {
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
      <Sink.Header>
        <Sink.Options>
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
        </Sink.Options>
        <div style={{flexGrow: 1, minWidth: 0}}>
          <Suspense fallback={null}>
            <RowView reference={reference} />
          </Suspense>
        </div>
        <Sink.Options>
          <IconButton icon={IcRoundClose} onClick={onRemove} />
        </Sink.Options>
      </Sink.Header>
      {fields && (
        <Sink.Content>
          <InputForm type={fields} state={state} />
        </Sink.Content>
      )}
    </div>
  )
}
