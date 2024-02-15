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
import { CSS, FirstArgument } from '@dnd-kit/utilities'
import { Field } from 'alinea/core/Field'
import { Picker } from 'alinea/core/Picker'
import { Reference } from 'alinea/core/Reference'
import { Type } from 'alinea/core/Type'
import { ListRow } from 'alinea/core/shape/ListShape'
import { entries } from 'alinea/core/util/Objects'
import { FormRow } from 'alinea/dashboard/atoms/FormAtoms'
import { InputForm } from 'alinea/dashboard/editor/InputForm'
import { useField } from 'alinea/dashboard/editor/UseField'
import { Create } from 'alinea/dashboard/view/Create'
import { IconButton } from 'alinea/dashboard/view/IconButton'
import { InputLabel } from 'alinea/dashboard/view/InputLabel'
import { TextLabel, fromModule } from 'alinea/ui'
import { Sink } from 'alinea/ui/Sink'
import { IcRoundClose } from 'alinea/ui/icons/IcRoundClose'
import IcRoundDragHandle from 'alinea/ui/icons/IcRoundDragHandle'
import { IcRoundEdit } from 'alinea/ui/icons/IcRoundEdit'
import { IcRoundLink } from 'alinea/ui/icons/IcRoundLink'
import { CSSProperties, HTMLAttributes, Ref, Suspense, useState } from 'react'
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
              {value && options.pickers[value[Reference.type]] ? (
                <LinkInputRow<Row>
                  readOnly={readOnly}
                  field={field}
                  rowId={value[Reference.id]}
                  fields={options.pickers[value[Reference.type]].fields}
                  picker={options.pickers[value[Reference.type]]}
                  reference={value as Row}
                  onRemove={() => mutator.replace(undefined)}
                  onEdit={() => setPickFrom(value[Reference.type])}
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
  const [pickFrom, setPickFrom] = useState<{[Reference.type]: string, [Reference.id]?: string} | undefined>()
  const picker = pickFrom
    ? options.pickers[pickFrom[Reference.type]]
    : undefined

  function handleConfirm(links: Array<ListRow & Row>) {
    if (!pickFrom || !picker || !links) return
    const seen = new Set()
    for (const link of links) {
      if (link[ListRow.type] !== pickFrom[Reference.type]) continue
      seen.add(link[ListRow.id])
      const index = value.findIndex(v => v[ListRow.id] === link[ListRow.id])
      if (index > -1) mutator.replace(link[ListRow.id], link)
      else mutator.push(link)
    }
    if (picker.handlesMultiple)
      for (const link of value) {
        if (link[ListRow.type] !== pickFrom[Reference.type]) continue
        if (seen.has(link[ListRow.id])) continue
        mutator.remove(link[ListRow.id])
      }
    setPickFrom(undefined)
  }

  const ids = value.map(row => row[ListRow.id])

  const [dragging, setDragging] = useState<Reference | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const {active} = event
    setDragging(value.find(row => row[ListRow.id] === active.id) || null)
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
          type={pickFrom[Reference.type]!}
          options={picker.options}
          selection={value.filter(ref => {
            if (ref[ListRow.id] === pickFrom[Reference.id]) return true
            if (picker.handlesMultiple)
              return ref[ListRow.type] === pickFrom[Reference.type]
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
                    if (!options.pickers[reference[ListRow.type]]) return null
                    const type = options.pickers[reference[ListRow.type]].fields
                    return (
                      <LinkInputRowSortable<Row>
                        key={reference[ListRow.id]}
                        rowId={reference[ListRow.id]}
                        field={field}
                        fields={type}
                        picker={options.pickers[reference[ListRow.type]]}
                        reference={reference as ListRow & Row}
                        onRemove={() => mutator.remove(reference[ListRow.id])}
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
                              onClick={() =>
                                setPickFrom({[Reference.type]: name})
                              }
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
                {dragging && options.pickers[dragging[Reference.type]] ? (
                  <LinkInputRow<Row>
                    field={field}
                    rowId={dragging._id}
                    fields={options.pickers[dragging[Reference.type]].fields}
                    picker={options.pickers[dragging[Reference.type]]}
                    reference={dragging as Row}
                    onRemove={() => mutator.remove(dragging._id)}
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
      id: props.reference._id
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
