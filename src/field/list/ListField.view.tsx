import styler from '@alinea/styler'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DraggableSyntheticListeners,
  DragOverlay,
  type DragStartEvent,
  defaultDropAnimation,
  KeyboardSensor,
  LayoutMeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  type AnimateLayoutChanges,
  defaultAnimateLayoutChanges,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {CSS, type FirstArgument} from '@dnd-kit/utilities'
import type {ListField} from 'alinea/core/field/ListField'
import {getType} from 'alinea/core/Internal'
import type {Schema} from 'alinea/core/Schema'
import {ListRow} from 'alinea/core/shape/ListShape'
import {Type} from 'alinea/core/Type'
import {entries} from 'alinea/core/util/Objects'
import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useField} from 'alinea/dashboard/editor/UseField'
import {Create} from 'alinea/dashboard/view/Create'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {type Foldable, InputLabel} from 'alinea/dashboard/view/InputLabel'
import {Icon, TextLabel} from 'alinea/ui'
import {IcBaselineContentCopy} from 'alinea/ui/icons/IcBaselineContentCopy'
import {IcBaselineContentPasteGo} from 'alinea/ui/icons/IcBaselineContentPasteGo'
import {IcOutlineList} from 'alinea/ui/icons/IcOutlineList'
import {IcRoundAdd} from 'alinea/ui/icons/IcRoundAdd'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundDragHandle} from 'alinea/ui/icons/IcRoundDragHandle'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowUp} from 'alinea/ui/icons/IcRoundKeyboardArrowUp'
import IcRoundUnfoldLess from 'alinea/ui/icons/IcRoundUnfoldLess'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {Sink} from 'alinea/ui/Sink'
import {useAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import {
  type CSSProperties,
  type HTMLAttributes,
  type PropsWithChildren,
  type Ref,
  useEffect,
  useState
} from 'react'
import type {ListOptions} from './ListField.js'
import css from './ListField.module.scss'

const styles = styler(css)

const copyAtom = atomWithStorage<ListRow | undefined>(
  '@alinea/copypaste',
  undefined
)

function animateLayoutChanges(args: FirstArgument<AnimateLayoutChanges>) {
  const {isSorting, wasSorting} = args
  if (isSorting || wasSorting) return defaultAnimateLayoutChanges(args)
  return true
}

function ListInputRowSortable(props: ListInputRowProps) {
  const {onCreate, onPaste} = props
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({
      animateLayoutChanges,
      id: props.row._id
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
      onCreate={onCreate}
      onPaste={onPaste}
    />
  )
}

type ListInputRowProps = PropsWithChildren<
  {
    row: ListRow
    schema: Schema
    isDragging?: boolean
    readOnly?: boolean
    onMove?: (direction: 1 | -1) => void
    onDelete?: () => void
    onCopyBlock?: () => void
    handle?: DraggableSyntheticListeners
    // React ts types force our hand here since it's a generic component,
    // and forwardRef does not forward generics.
    // There's probably an issue for this on DefinitelyTyped.
    rootRef?: Ref<HTMLDivElement>
    isDragOverlay?: boolean
    onCreate?: (type: string) => void
    onPasteBlock?: (data: ListRow) => void
    firstRow?: boolean
    folded?: boolean
    toggleFold?: () => void
  } & HTMLAttributes<HTMLDivElement>
>

function ListInputRow({
  row,
  schema,
  onMove,
  onDelete,
  onCopyBlock,
  handle,
  rootRef,
  isDragging,
  isDragOverlay,
  readOnly,
  onCreate,
  onPasteBlock,
  firstRow,
  folded,
  toggleFold,
  ...rest
}: ListInputRowProps) {
  const type = schema[row[ListRow.type]]
  const [showInsert, setShowInsert] = useState(false)
  if (!type) return null
  return (
    <div
      className={styles.row({dragging: isDragging, overlay: isDragOverlay})}
      ref={rootRef}
      {...rest}
    >
      {!readOnly && !isDragOverlay && (
        <ListInsertRow
          open={showInsert}
          first={Boolean(firstRow)}
          onInsert={() => setShowInsert(!showInsert)}
        />
      )}
      {showInsert && (
        <ListCreateRow
          inline
          schema={schema}
          onCreate={(type: string) => {
            onCreate!(type)
            setShowInsert(false)
          }}
          onPaste={(data: ListRow) => {
            if (onPasteBlock) onPasteBlock(data)
            setShowInsert(false)
          }}
        />
      )}
      <Sink.Header>
        <Sink.Options style={{zIndex: 1}}>
          <IconButton
            icon={getType(type).icon || IcRoundDragHandle}
            {...handle}
            style={{cursor: handle ? 'grab' : 'grabbing'}}
            title="Drag and drop to reorder"
          />
        </Sink.Options>
        <Sink.Title>
          <TextLabel
            label={Type.label(type)}
            className={styles.row.header.title()}
          />
        </Sink.Title>
        <Sink.Options>
          {onCopyBlock !== undefined && (
            <IconButton
              icon={IcBaselineContentCopy}
              onClick={() => onCopyBlock()}
              title="Copy block"
            />
          )}
          {!readOnly && (
            <>
              {typeof folded !== 'undefined' && (
                <IconButton
                  icon={folded ? IcRoundUnfoldMore : IcRoundUnfoldLess}
                  onClick={toggleFold}
                  title={folded ? 'Unfold' : 'Fold'}
                />
              )}
              <IconButton
                icon={IcRoundKeyboardArrowUp}
                onClick={() => onMove?.(-1)}
                title="Move up one position"
              />
              <IconButton
                icon={IcRoundKeyboardArrowDown}
                onClick={() => onMove?.(1)}
                title="Move down one position"
              />
              <IconButton
                icon={IcRoundClose}
                onClick={onDelete}
                title="Delete block"
              />
            </>
          )}
        </Sink.Options>
      </Sink.Header>
      {!folded && (
        <Sink.Content>
          <InputForm type={type} />
        </Sink.Content>
      )}
    </div>
  )
}

interface ListCreateRowProps {
  schema: Schema
  readOnly?: boolean
  inline?: boolean
  onCreate: (type: string, data?: ListRow) => void
  onPaste: (data: ListRow) => void
}

function ListCreateRow({
  schema,
  readOnly,
  inline,
  onCreate,
  onPaste
}: ListCreateRowProps) {
  const [pasted] = useAtom(copyAtom)
  const canPaste =
    pasted && entries(schema).some(([key]) => key === pasted._type)
  return (
    <div className={styles.create({inline})}>
      <Create.Root disabled={readOnly}>
        {entries(schema).map(([key, type]) => {
          return (
            <Create.Button
              icon={getType(type).icon}
              key={key}
              onClick={() => onCreate(key)}
            >
              <TextLabel label={Type.label(type)} />
            </Create.Button>
          )
        })}
        {canPaste && (
          <Create.Button
            icon={IcBaselineContentPasteGo}
            onClick={() => onPaste(pasted)}
            mod="paste"
          >
            <TextLabel label="Paste block" />
          </Create.Button>
        )}
      </Create.Root>
    </div>
  )
}

interface ListInsertRowProps {
  first: boolean
  open: boolean
  onInsert: () => void
}

function ListInsertRow({first, open, onInsert}: ListInsertRowProps) {
  return (
    <div className={styles.insert({open, first})}>
      <button
        className={styles.insert.icon()}
        onClick={onInsert}
        title="Insert new block"
        type="button"
      >
        <Icon icon={open ? IcRoundKeyboardArrowUp : IcRoundAdd} />
      </button>
    </div>
  )
}

export interface ListInputProps {
  field: ListField<ListRow, ListRow, ListOptions<Schema>>
}

const layoutMeasuringConfig = {
  strategy: LayoutMeasuringStrategy.Always
}

export function ListInput({field}: ListInputProps) {
  const initialFolded = 'unfold' as Foldable
  const {options, value, mutator, error} = useField(field)
  const {schema, readOnly} = options
  const rows: Array<ListRow> = value as any
  const ids = rows.map(row => row._id)
  const [, setPasted] = useAtom(copyAtom)
  const [dragging, setDragging] = useState<ListRow | null>(null)
  const [foldable, setFoldable] = useState<Foldable>(initialFolded)
  const [foldedItems, setFoldedItems] = useState<Set<string>>(new Set())
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const {active} = event
    setDragging(rows.find(row => row._id === active.id) || null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event
    if (!over || active.id === over.id) return

    if (!readOnly) mutator.move(ids.indexOf(active.id), ids.indexOf(over.id))
    setDragging(null)
  }

  useEffect(() => {
    if (
      rows.length === 0 ||
      foldedItems.size === 0 ||
      foldedItems.size !== rows.length
    ) {
      setFoldable('unfold')
    } else setFoldable('fold')
  }, [foldedItems, rows.length])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      layoutMeasuring={layoutMeasuringConfig}
    >
      <InputLabel
        {...options}
        error={error}
        icon={IcOutlineList}
        foldable={foldable}
        foldableIsDisabled={rows.length === 0}
        foldableHandler={() => {
          if (foldable === 'fold') {
            setFoldedItems(new Set<string>())
          } else {
            const newFoldedItems = new Set<string>()
            rows.forEach(row => {
              newFoldedItems.add(row._id)
            })
            setFoldedItems(newFoldedItems)
          }
          setFoldable(f => (f === 'fold' ? 'unfold' : 'fold'))
        }}
      >
        <div className={styles.root()}>
          <div className={styles.root.inner({inline: options.inline})}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <Sink.Root>
                {rows.map((row, i) => {
                  const type = options.schema[row[ListRow.type]]
                  return (
                    <FormRow
                      key={row._id}
                      field={field}
                      rowId={row._id}
                      type={type}
                      readOnly={readOnly}
                    >
                      <ListInputRowSortable
                        folded={foldedItems.has(row._id)}
                        row={row}
                        schema={schema}
                        readOnly={readOnly}
                        onCopyBlock={() => {
                          const data = mutator.read(row._id)
                          setPasted(data)
                        }}
                        onMove={direction => {
                          if (readOnly) return
                          mutator.move(i, i + direction)
                        }}
                        onDelete={() => {
                          if (readOnly) return
                          mutator.remove(row._id)
                          setFoldedItems(fi => {
                            fi.delete(row._id)
                            return new Set<string>(fi)
                          })
                        }}
                        onCreate={(type: string) => {
                          if (readOnly) return
                          mutator.push({_type: type} as any, i)
                          setFoldable('unfold')
                        }}
                        onPasteBlock={(data: ListRow) => {
                          if (readOnly) return
                          const {_id, _index, ...rest} = data
                          mutator.push(rest, i)
                          setFoldable('unfold')
                        }}
                        toggleFold={() => {
                          setFoldedItems(fi => {
                            if (fi.has(row._id)) fi.delete(row._id)
                            else fi.add(row._id)
                            return new Set<string>(fi)
                          })
                        }}
                        firstRow={i === 0}
                      />
                    </FormRow>
                  )
                })}
                <ListCreateRow
                  schema={schema}
                  readOnly={readOnly}
                  onPaste={(data: ListRow) => {
                    const {_id, _index, ...rest} = data
                    mutator.push(rest)
                    setFoldable('unfold')
                  }}
                  onCreate={(type: string, data?: ListRow) => {
                    if (readOnly) return
                    mutator.push({_type: type} as any)
                    setFoldable('unfold')
                  }}
                />
              </Sink.Root>
            </SortableContext>

            <DragOverlay
              dropAnimation={{
                ...defaultDropAnimation,
                dragSourceOpacity: 0.5
              }}
            >
              {dragging ? (
                <FormRow
                  key="overlay"
                  field={field}
                  rowId={dragging._id}
                  type={options.schema[dragging[ListRow.type]]}
                  readOnly={readOnly}
                >
                  <ListInputRow
                    key="overlay"
                    row={dragging}
                    schema={schema}
                    isDragOverlay
                    folded={foldedItems.has(dragging._id)}
                  />
                </FormRow>
              ) : null}
            </DragOverlay>
          </div>
        </div>
      </InputLabel>
    </DndContext>
  )
}
