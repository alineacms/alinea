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
import {Field, ListRow, Picker, Reference, Type} from 'alinea/core'
import {entries} from 'alinea/core/util/Objects'
import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useField} from 'alinea/dashboard/editor/UseField'
import {Create} from 'alinea/dashboard/view/Create'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {TextLabel, fromModule} from 'alinea/ui'
import {Sink} from 'alinea/ui/Sink'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import IcRoundDragHandle from 'alinea/ui/icons/IcRoundDragHandle'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'
import {CSSProperties, HTMLAttributes, Ref, Suspense, useState} from 'react'
import {
  LinkField,
  LinksField,
  createLink as createLinkField,
  createLinks as createLinksField
} from './LinkField.js'
import css from './LinkField.module.scss'

export type * from './LinkField.js'

const styles = fromModule(css)

export const createLink = Field.provideView(SingleLinkInput, createLinkField)
export const createLinks = Field.provideView(
  MultipleLinksInput,
  createLinksField
)

interface LinkInputProps<Row extends Reference> {
  field: LinkField<Row>
}

function SingleLinkInput<Row extends Reference>({field}: LinkInputProps<Row>) {
  const {options, value, mutator, error} = useField(field)
  const {readOnly} = options
  const [pickFrom, setPickFrom] = useState<string | undefined>()
  const picker = pickFrom ? options.pickers[pickFrom] : undefined

  function handleConfirm(link: Array<Reference>) {
    if (readOnly) return
    const selected = link[0]
    if (!pickFrom || !picker || !selected) return
    mutator.replace(selected as Row)
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
      <InputLabel {...options} error={error} icon={IcRoundLink}>
        <div className={styles.root()}>
          <div className={styles.root.inner()}>
            <Sink.Root>
              {value && options.pickers[value.type] ? (
                <LinkInputRow<Row>
                  readOnly={readOnly}
                  field={field}
                  rowId={value.id}
                  fields={options.pickers[value.type].fields}
                  picker={options.pickers[value.type]}
                  reference={value as Row}
                  onRemove={() => mutator.replace(undefined)}
                  onEdit={() => setPickFrom(value.type)}
                />
              ) : (
                <div className={styles.create()}>
                  <Create.Root disabled={readOnly}>
                    {entries(options.pickers).map(([name, picker]) => {
                      return (
                        <Create.Button
                          key={name}
                          onClick={() => {
                            if (readOnly) return
                            setPickFrom(name)
                          }}
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

interface LinksInputProps<Row extends Reference & ListRow> {
  field: LinksField<Row>
}

function MultipleLinksInput<Row extends Reference & ListRow>({
  field
}: LinksInputProps<Row>) {
  const {options, value, mutator, error} = useField(field)
  const {readOnly} = options
  const [pickFrom, setPickFrom] = useState<
    {type: string; id?: string} | undefined
  >()
  const picker = pickFrom ? options.pickers[pickFrom.type] : undefined

  function handleConfirm(links: Array<ListRow & Row>) {
    if (!pickFrom || !picker || !links) return
    const seen = new Set()
    for (const link of links) {
      if (link.type !== pickFrom.type) continue
      seen.add(link.id)
      const index = value.findIndex(v => v.id === link.id)
      if (index > -1) mutator.replace(link.id, link)
      else mutator.push(link)
    }
    if (picker.handlesMultiple)
      for (const link of value) {
        if (link.type !== pickFrom.type) continue
        if (seen.has(link.id)) continue
        mutator.remove(link.id)
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
    if (!readOnly) mutator.move(ids.indexOf(active.id), ids.indexOf(over.id))
    setDragging(null)
  }

  const showLinkPicker = options.max ? value.length < options.max : true

  const PickerView = picker && picker.view!

  return (
    <>
      {pickFrom && PickerView && (
        <PickerView
          type={pickFrom.type}
          options={picker.options}
          selection={value.filter(ref => {
            if (ref.id === pickFrom.id) return true
            if (picker.handlesMultiple) return ref.type === pickFrom.type
            return false
          })}
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
        <InputLabel {...options} error={error} icon={IcRoundLink}>
          <div className={styles.root()}>
            <div className={styles.root.inner()}>
              <SortableContext
                items={ids}
                strategy={verticalListSortingStrategy}
              >
                <Sink.Root>
                  {value.map(reference => {
                    if (!options.pickers[reference.type]) return null
                    const type = options.pickers[reference.type].fields
                    return (
                      <LinkInputRowSortable<Row>
                        key={reference.id}
                        rowId={reference.id}
                        field={field}
                        fields={type}
                        picker={options.pickers[reference.type]}
                        reference={reference as ListRow & Row}
                        onRemove={() => mutator.remove(reference.id)}
                        onEdit={() => setPickFrom(reference)}
                        isSortable={options.max !== 1}
                        readOnly={readOnly}
                        multiple
                      />
                    )
                  })}

                  {showLinkPicker && (
                    <div className={styles.create()}>
                      <Create.Root disabled={readOnly}>
                        {entries(options.pickers).map(([name, picker]) => {
                          return (
                            <Create.Button
                              key={name}
                              onClick={() => setPickFrom({type: name})}
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
                    field={field}
                    rowId={dragging.id}
                    fields={options.pickers[dragging.type].fields}
                    picker={options.pickers[dragging.type]}
                    reference={dragging as Row}
                    onRemove={() => mutator.remove(dragging.id)}
                    onEdit={() => setPickFrom(dragging)}
                    isDragOverlay
                    isSortable={options.max !== 1}
                    readOnly={readOnly}
                    multiple
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
  field: Field
  rowId: string
  picker: Picker<Row>
  fields: Type<Row> | undefined
  reference: Row
  onEdit(): void
  onRemove(): void
  isDragging?: boolean
  isDragOverlay?: boolean
  isSortable?: boolean
  handle?: DraggableSyntheticListeners
  rootRef?: Ref<HTMLDivElement>
  readOnly?: boolean
  multiple?: boolean
}

function LinkInputRow<Row extends Reference>({
  field,
  rowId,
  picker,
  fields,
  reference,
  onEdit,
  onRemove,
  handle,
  rootRef,
  isDragging,
  isDragOverlay,
  isSortable,
  readOnly,
  multiple,
  ...rest
}: LinkInputRowProps<Row>) {
  const RowView = picker.viewRow!
  const inner = (
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
        {!readOnly && (
          <Sink.Options>
            <IconButton icon={IcRoundEdit} onClick={onEdit} />
            <IconButton icon={IcRoundClose} onClick={onRemove} />
          </Sink.Options>
        )}
      </Sink.Header>
      {fields && (
        <Sink.Content>
          <InputForm type={fields} />
        </Sink.Content>
      )}
    </div>
  )
  if (!fields) return inner
  return (
    <FormRow
      field={field}
      type={fields}
      readOnly={readOnly}
      rowId={multiple ? rowId : undefined}
    >
      {inner}
    </FormRow>
  )
}
