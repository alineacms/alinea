import styler from '@alinea/styler'
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
import {Entry} from 'alinea/core/Entry'
import {Field} from 'alinea/core/Field'
import {Picker} from 'alinea/core/Picker'
import {Reference} from 'alinea/core/Reference'
import {Type} from 'alinea/core/Type'
import {MediaFile} from 'alinea/core/media/MediaTypes'
import {ListRow} from 'alinea/core/shape/ListShape'
import {entries} from 'alinea/core/util/Objects'
import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useField} from 'alinea/dashboard/editor/UseField'
import {useGraph} from 'alinea/dashboard/hook/UseGraph'
import {useLocale} from 'alinea/dashboard/hook/UseLocale'
import {useNav} from 'alinea/dashboard/hook/UseNav'
import {SuspenseBoundary} from 'alinea/dashboard/util/SuspenseBoundary'
import {Create} from 'alinea/dashboard/view/Create'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {EntryReference} from 'alinea/picker/entry/EntryReference'
import {UrlReference} from 'alinea/picker/url/UrlPicker'
import {TextLabel} from 'alinea/ui'
import {Sink} from 'alinea/ui/Sink'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import IcRoundDragHandle from 'alinea/ui/icons/IcRoundDragHandle'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'
import {IcRoundOpenInNew} from 'alinea/ui/icons/IcRoundOpenInNew'
import {CSSProperties, HTMLAttributes, Ref, Suspense, useState} from 'react'
import {LinkField, LinksField} from './LinkField.js'
import css from './LinkField.module.scss'

export type * from './LinkField.js'

const styles = styler(css)

export interface LinkInputProps<Row> {
  field: LinkField<Reference, Row>
}

export function SingleLinkInput<Row>({field}: LinkInputProps<Row>) {
  const {options, value, mutator, error} = useField(field)
  const {readOnly} = options
  const [pickFrom, setPickFrom] = useState<string | undefined>()
  const picker = pickFrom ? options.pickers[pickFrom] : undefined

  function handleConfirm(link: Array<Reference>) {
    if (readOnly) return
    const selected = link[0]
    if (!pickFrom || !picker || !selected) return
    if (selected[Reference.type] !== pickFrom) return
    mutator.replace(selected)
    setPickFrom(undefined)
  }

  const PickerView = picker && picker.view!

  return (
    <>
      {PickerView && (
        <SuspenseBoundary name="picker">
          <PickerView
            type={pickFrom!}
            options={picker.options}
            selection={[value]}
            onConfirm={handleConfirm}
            onCancel={() => setPickFrom(undefined)}
          />
        </SuspenseBoundary>
      )}
      <InputLabel {...options} error={error} icon={IcRoundLink}>
        <div className={styles.root()}>
          <div className={styles.root.inner()}>
            <Sink.Root>
              {value && options.pickers[value[Reference.type]] ? (
                <LinkInputRow
                  readOnly={readOnly}
                  field={field}
                  rowId={value[Reference.id]}
                  fields={options.pickers[value[Reference.type]].fields}
                  picker={options.pickers[value[Reference.type]]}
                  reference={value}
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

export interface LinksInputProps<Row> {
  field: LinksField<ListRow, Row>
}

export function MultipleLinksInput<Row>({field}: LinksInputProps<Row>) {
  const {options, value, mutator, error} = useField(field)
  const {readOnly} = options
  const [pickFrom, setPickFrom] = useState<
    {[Reference.type]: string; [Reference.id]?: string} | undefined
  >()
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
                    const picker = options.pickers[reference[ListRow.type]]
                    const type = picker.fields
                    return (
                      <LinkInputRowSortable
                        key={reference[ListRow.id]}
                        rowId={reference[ListRow.id]}
                        field={field}
                        fields={type}
                        picker={picker}
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
                  <LinkInputRow
                    field={field}
                    rowId={dragging._id}
                    fields={options.pickers[dragging[Reference.type]].fields}
                    picker={options.pickers[dragging[Reference.type]]}
                    reference={dragging}
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

function LinkInputRowSortable(props: LinkInputRowProps) {
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

interface LinkInputRowProps extends HTMLAttributes<HTMLDivElement> {
  field: Field
  rowId: string
  picker: Picker<Reference>
  fields: Type | undefined
  reference: Reference
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

function LinkInputRow({
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
}: LinkInputRowProps) {
  const onView = useReferenceViewer()
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
            <IconButton
              icon={IcRoundOpenInNew}
              onClick={() => onView(reference)}
            />
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

function useReferenceViewer() {
  const nav = useNav()
  const locale = useLocale()
  const graph = useGraph()
  return (reference: Reference) => {
    if (UrlReference.isUrl(reference)) {
      window.open(reference[UrlReference.url], '_blank')
    } else if (EntryReference.isEntryReference(reference)) {
      graph
        .first({
          id: reference[EntryReference.entry],
          locale,
          select: {
            id: Entry.id,
            workspace: Entry.workspace,
            root: Entry.root,
            location: MediaFile.location
          },
          status: 'preferDraft'
        })
        .then(entry => {
          if (!entry) return
          window.open(entry.location ?? `#${nav.entry(entry)}`, '_blank')
        })
    }
  }
}
