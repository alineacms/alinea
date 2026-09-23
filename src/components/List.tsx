import styler from '@alinea/styler'
import {
  type ComponentPropsWithoutRef,
  type ComponentType,
  createContext,
  type DOMAttributes,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
  useContext,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  DragPreview,
  type DragPreviewRenderer,
  mergeProps,
  useDrag,
  useDrop
} from 'react-aria'
import css from './List.module.css'
import {Button, type ButtonProps} from './Button.js'
import {FieldDescription, FieldSharedBadge} from './Field.js'
import {FoldIcon} from './FoldIcon.js'
import {Icon} from './Icon.js'
import {Surface, SurfaceRow, type SurfaceProps} from './Surface.js'
import type {DragMoveEvent, DropTarget, Key} from './types.js'

const styles = styler(css)

const DEFAULT_DRAG_TYPE = 'alinea/list-row'

type RowDropPosition = 'before' | 'after'

interface ListRowDropTarget extends DropTarget {
  position: RowDropPosition
}

interface ListReorderContextValue {
  dragType: string
  draggingKey: Key | null
  dropTarget: ListRowDropTarget | null
  /** Whether the current drag was started with a pointer (native drag) */
  pointerDrag: RefObject<boolean>
  /** Row element of the dragged row */
  source: RefObject<HTMLElement | null>
  startDrag(key: Key, row: HTMLElement | null, pointer: boolean): void
  endDrag(): void
  setDropTarget(target: ListRowDropTarget | null, exit?: boolean): void
  drop(target: ListRowDropTarget): void
}

const ListReorderContext = createContext<ListReorderContextValue | null>(null)

interface ListRowDragContextValue {
  dragProps: DOMAttributes<HTMLElement>
  dragging: boolean
  handle: RefObject<HTMLSpanElement>
}

const ListRowDragContext = createContext<ListRowDragContextValue | null>(null)

export interface ListProps extends SurfaceProps {
  empty?: boolean
  /**
   * Enables reordering: rows with an `id` can be dragged by their
   * `ListRowDragHandle`, with a pointer or with the keyboard (Enter on the
   * handle, Tab to a row, Enter to drop). Called with the key of the dragged
   * row and the row it was dropped before or after.
   * Rows only drop within the list they were dragged from.
   */
  onReorder?: (event: DragMoveEvent) => void
  /** Mime type the dragged rows carry, defaults to `alinea/list-row` */
  dragType?: string
}

export function List({
  className,
  empty,
  role,
  onReorder,
  dragType = DEFAULT_DRAG_TYPE,
  ...props
}: ListProps) {
  const [draggingKey, setDraggingKey] = useState<Key | null>(null)
  const [dropTarget, setDropTargetState] = useState<ListRowDropTarget | null>(
    null
  )
  const pointerDrag = useRef(false)
  const source = useRef<HTMLElement | null>(null)
  const dragged = useRef<Key | null>(null)
  const reorderRef = useRef(onReorder)
  reorderRef.current = onReorder
  const reorderable = Boolean(onReorder)
  const reorder = useMemo<ListReorderContextValue | null>(() => {
    if (!reorderable) return null
    return {
      dragType,
      draggingKey,
      dropTarget,
      pointerDrag,
      source,
      startDrag(key, row, pointer) {
        dragged.current = key
        source.current = row
        pointerDrag.current = pointer
        setDraggingKey(key)
      },
      endDrag() {
        dragged.current = null
        source.current = null
        pointerDrag.current = false
        setDraggingKey(null)
        setDropTargetState(null)
      },
      setDropTarget(target, exit) {
        setDropTargetState(current => {
          if (!exit) return target
          // Only clear the target if it was not replaced by another row yet
          return current && target && current.key !== target.key
            ? current
            : null
        })
      },
      drop(target) {
        const key = dragged.current
        setDropTargetState(null)
        if (key === null || key === target.key) return
        reorderRef.current?.({keys: new Set([key]), target})
      }
    }
  }, [reorderable, dragType, draggingKey, dropTarget])
  return (
    <ListReorderContext.Provider value={reorder}>
      <Surface
        data-slot="list"
        {...props}
        className={className}
        role={role ?? (empty ? 'status' : 'list')}
      />
    </ListReorderContext.Provider>
  )
}

export interface ListItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  leading?: ReactNode
  trailing?: ReactNode
  inner?: ReactNode
  onPress?: () => void
  selected?: boolean
}

export function ListItem({
  leading,
  trailing,
  inner,
  children,
  onPress,
  selected,
  ...props
}: ListItemProps) {
  const headerContent = (
    <>
      {leading && <div className={styles.ListItem.leading()}>{leading}</div>}
      {children && <div className={styles.ListItem.content()}>{children}</div>}
      {trailing && <div className={styles.ListItem.trailing()}>{trailing}</div>}
    </>
  )
  return (
    <SurfaceRow
      {...props}
      className={styles.ListItem(styler.merge(props))}
      data-has-leading={leading ? 'true' : undefined}
      data-selected={selected || undefined}
      role={props.role ?? 'listitem'}
    >
      {onPress ? (
        <Button
          variant="ghost"
          aria-pressed={selected || undefined}
          className={styles.ListItem.header()}
          data-action="true"
          onClick={() => onPress()}
        >
          {headerContent}
        </Button>
      ) : (
        <header className={styles.ListItem.header()}>{headerContent}</header>
      )}
      {inner && <div className={styles.ListItem.inner()}>{inner}</div>}
    </SurfaceRow>
  )
}

export interface ListItemVisualProps extends ComponentPropsWithoutRef<'span'> {}

export function ListItemVisual({className, ...props}: ListItemVisualProps) {
  return (
    <span
      {...props}
      className={styles.ListItemVisual(styler.merge({className}))}
    />
  )
}

export interface ListItemTitleProps extends ComponentPropsWithoutRef<'span'> {}

export function ListItemTitle({className, ...props}: ListItemTitleProps) {
  return (
    <span
      {...props}
      className={styles.ListItemTitle(styler.merge({className}))}
    />
  )
}

export interface ListItemDescriptionProps extends ComponentPropsWithoutRef<'span'> {}

export function ListItemDescription({
  className,
  ...props
}: ListItemDescriptionProps) {
  return (
    <span
      {...props}
      className={styles.ListItemDescription(styler.merge({className}))}
    />
  )
}

export interface ListItemStatusProps extends ComponentPropsWithoutRef<'span'> {
  tone?: 'neutral' | 'accent' | 'positive' | 'warning' | 'danger'
}

export function ListItemStatus({
  className,
  tone = 'neutral',
  ...props
}: ListItemStatusProps) {
  return (
    <span
      {...props}
      className={styles.ListItemStatus(styler.merge({className}))}
      data-tone={tone}
    />
  )
}

export interface ListEmptyProps extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'title'
> {
  icon?: ComponentType
  title: ReactNode
}

export function ListEmpty({
  children,
  className,
  icon,
  title,
  ...props
}: ListEmptyProps) {
  return (
    <div {...props} className={styles.ListEmpty(styler.merge({className}))}>
      {icon && (
        <ListItemVisual>
          <Icon data-slot="icon" icon={icon} />
        </ListItemVisual>
      )}
      <div className={styles.ListEmpty.content()}>
        <strong className={styles.ListEmpty.title()}>{title}</strong>
        {children && (
          <span className={styles.ListEmpty.description()}>{children}</span>
        )}
      </div>
    </div>
  )
}

export interface ListLabelProps extends Omit<
  ButtonProps,
  'variant' | 'children' | 'className' | 'size'
> {
  children: ReactNode
  className?: string
  expanded: boolean
  hasRows?: boolean
  shared?: boolean
  showFold?: boolean
  description?: ReactNode
  inline?: boolean
}

export function ListLabel({
  children,
  expanded,
  hasRows,
  shared,
  showFold = true,
  className,
  description,
  inline = false,
  ...props
}: ListLabelProps) {
  if (inline && !showFold && !description && !shared) return null

  return (
    <div className={styles.ListLabel(styler.merge({className}))}>
      {(!inline || showFold) && (
        <Button
          {...props}
          variant="ghost"
          className={styles.ListLabel.toggle()}
          data-has-rows={hasRows ? 'true' : undefined}
          disabled={props.disabled ?? !hasRows}
        >
          <span className={styles.ListLabel.title()}>
            {!inline && (
              <span className={styles.ListLabel.title.text()}>{children}</span>
            )}
            {showFold && (
              <FoldIcon aria-hidden data-slot="icon" expanded={expanded} />
            )}
          </span>
        </Button>
      )}
      {description && <FieldDescription>{description}</FieldDescription>}
      {shared && <FieldSharedBadge />}
    </div>
  )
}

export interface ListErrorProps extends ComponentPropsWithoutRef<'div'> {}

export function ListError({className, ...props}: ListErrorProps) {
  return (
    <div {...props} className={styles.ListError(styler.merge({className}))} />
  )
}

export interface ListCreateRowProps extends ComponentPropsWithoutRef<'div'> {
  empty?: boolean
}

export function ListCreateRow({
  children,
  className,
  empty,
  ...props
}: ListCreateRowProps) {
  return (
    <div
      {...props}
      className={styles.ListCreateRow(styler.merge({className}))}
      data-empty={empty || undefined}
    >
      <div className={styles.ListCreateRow.inner()}>{children}</div>
    </div>
  )
}

export interface ListRowProps extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'id'
> {
  /**
   * Identifies the row within its list. Rows with an id can be dragged when
   * the list has `onReorder`. The id is not rendered as a DOM id.
   */
  id?: Key
  /** Shows the row as being dragged, detected automatically when reordering */
  dragging?: boolean
  first?: boolean
  /** Rendered under the pointer while dragging, eg. a `ListDragPreview` */
  dragPreview?: ReactNode
}

export function ListRow({id, dragPreview, ...props}: ListRowProps) {
  const reorder = useContext(ListReorderContext)
  if (reorder && id !== undefined)
    return (
      <ReorderableListRow
        {...props}
        dragPreview={dragPreview}
        id={id}
        reorder={reorder}
      />
    )
  return (
    <ListRowDragContext.Provider value={null}>
      <ListRowElement {...props} />
    </ListRowDragContext.Provider>
  )
}

function ListRowElement({
  className,
  dragging,
  first,
  ...props
}: Omit<ListRowProps, 'id' | 'dragPreview'>) {
  return (
    <div
      data-slot="list-row"
      {...props}
      className={styles.ListRow(styler.merge({className}))}
      data-dragging={dragging || undefined}
      data-first-row={
        first === undefined ? undefined : first ? 'true' : 'false'
      }
    />
  )
}

interface ReorderableListRowProps extends Omit<ListRowProps, 'id'> {
  id: Key
  reorder: ListReorderContextValue
}

function ReorderableListRow({
  id,
  reorder,
  dragPreview,
  dragging,
  children,
  ...props
}: ReorderableListRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLSpanElement>(null)
  const preview = useRef<DragPreviewRenderer | null>(null)
  const nativeDrag = useRef(false)
  const {dragType, draggingKey, dropTarget} = reorder
  const {dragProps, isDragging} = useDrag({
    getItems() {
      return [{'text/plain': String(id), [dragType]: String(id)}]
    },
    getAllowedDropOperations() {
      return ['move']
    },
    onDragStart() {
      reorder.startDrag(id, ref.current, nativeDrag.current)
    },
    onDragEnd() {
      const keyboard = !nativeDrag.current
      nativeDrag.current = false
      reorder.endDrag()
      // Keep keyboard focus on the moved row
      if (keyboard)
        requestAnimationFrame(() => {
          if (handle.current?.isConnected) handle.current.focus()
        })
    },
    preview: dragPreview ? preview : undefined
  })
  const handleDragProps = useMemo<DOMAttributes<HTMLElement>>(
    () => ({
      ...dragProps,
      onDragStart(event) {
        // Native drag events are only fired for pointer drags
        nativeDrag.current = true
        dragProps.onDragStart?.(event)
      }
    }),
    [dragProps]
  )
  function dropPosition(y: number): RowDropPosition {
    const row = ref.current
    if (!row) return 'after'
    if (!reorder.pointerDrag.current) {
      // Keyboard drops take the place of the target row
      const source = reorder.source.current
      if (!source || source === row) return 'after'
      const sourceFollows =
        row.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING
      return sourceFollows ? 'before' : 'after'
    }
    return y < row.offsetHeight / 2 ? 'before' : 'after'
  }
  function acceptDrop(
    types: {has(type: string): boolean},
    allowedOperations: Array<string>
  ) {
    return types.has(dragType) && allowedOperations.includes('move')
      ? 'move'
      : 'cancel'
  }
  const {dropProps} = useDrop({
    ref,
    isDisabled: draggingKey === null,
    getDropOperation: acceptDrop,
    getDropOperationForPoint: acceptDrop,
    onDropEnter(event) {
      reorder.setDropTarget({key: id, position: dropPosition(event.y)})
    },
    onDropMove(event) {
      reorder.setDropTarget({key: id, position: dropPosition(event.y)})
    },
    onDropExit() {
      reorder.setDropTarget({key: id, position: 'after'}, true)
    },
    onDrop(event) {
      reorder.drop({key: id, position: dropPosition(event.y)})
    }
  })
  const active = dropTarget?.key === id ? dropTarget.position : undefined
  const rowDragging = dragging ?? isDragging
  const dragContext = useMemo<ListRowDragContextValue>(
    () => ({dragProps: handleDragProps, dragging: rowDragging, handle}),
    [handleDragProps, rowDragging]
  )
  return (
    <ListRowDragContext.Provider value={dragContext}>
      <div
        {...dropProps}
        className={styles.ListRow.dropTarget()}
        data-slot="list-row-drop-target"
        ref={ref}
        tabIndex={draggingKey !== null ? -1 : undefined}
      >
        <ListRowElement {...props} dragging={rowDragging}>
          {dragPreview && (
            <DragPreview ref={preview}>{() => <>{dragPreview}</>}</DragPreview>
          )}
          {children}
        </ListRowElement>
        <div
          aria-hidden
          className={styles.ListRow.dropIndicator()}
          data-active={active === 'before' || undefined}
          data-position="before"
          data-slot="list-row-drop-indicator"
        />
        <div
          aria-hidden
          className={styles.ListRow.dropIndicator()}
          data-active={active === 'after' || undefined}
          data-position="after"
          data-slot="list-row-drop-indicator"
        />
      </div>
    </ListRowDragContext.Provider>
  )
}

export interface ListRowDragHandleProps extends ComponentPropsWithoutRef<'span'> {
  /** Shows the handle as dragging, detected automatically when reordering */
  dragging?: boolean
}

/**
 * Drags its `ListRow` when the list has `onReorder`. Focusable in that case:
 * press Enter to start a keyboard drag.
 */
export function ListRowDragHandle({
  className,
  dragging,
  ...props
}: ListRowDragHandleProps) {
  const drag = useContext(ListRowDragContext)
  if (!drag)
    return (
      <span
        data-slot="list-row-drag-handle"
        {...props}
        className={styles.ListRowDragHandle(styler.merge({className}))}
        data-dragging={dragging || undefined}
      />
    )
  return (
    <span
      data-slot="list-row-drag-handle"
      role="button"
      tabIndex={0}
      {...mergeProps(props, drag.dragProps)}
      className={styles.ListRowDragHandle(styler.merge({className}))}
      data-dragging={(dragging ?? drag.dragging) || undefined}
      ref={drag.handle}
    />
  )
}

export interface ListRowHeaderProps extends ComponentPropsWithoutRef<'div'> {
  expanded?: boolean
  first?: boolean
  hasFold?: boolean
}

export function ListRowHeader({
  className,
  expanded,
  first,
  hasFold = true,
  ...props
}: ListRowHeaderProps) {
  return (
    <div
      {...props}
      className={styles.ListRowHeader(styler.merge({className}))}
      data-expanded={expanded ? 'true' : undefined}
      data-first-row={first ? 'true' : undefined}
      data-has-fold={hasFold ? 'true' : undefined}
    />
  )
}

export interface ListRowDragProps extends ComponentPropsWithoutRef<'div'> {
  dragging?: boolean
}

export function ListRowDrag({className, dragging, ...props}: ListRowDragProps) {
  const drag = useContext(ListRowDragContext)
  return (
    <div
      {...props}
      className={styles.ListRowDrag(styler.merge({className}))}
      data-dragging={(dragging ?? drag?.dragging) || undefined}
    />
  )
}

export interface ListRowBadgesProps extends ComponentPropsWithoutRef<'div'> {}

export function ListRowBadges({className, ...props}: ListRowBadgesProps) {
  return (
    <div
      {...props}
      className={styles.ListRowBadges(styler.merge({className}))}
    />
  )
}

export interface ListRowMetaProps extends ComponentPropsWithoutRef<'span'> {}

export function ListRowMeta({className, ...props}: ListRowMetaProps) {
  return (
    <span
      {...props}
      className={styles.ListRowMeta(styler.merge({className}))}
    />
  )
}

export interface ListRowActionsProps extends ComponentPropsWithoutRef<'div'> {}

export function ListRowActions({className, ...props}: ListRowActionsProps) {
  return (
    <div
      {...props}
      className={styles.ListRowActions(styler.merge({className}))}
    />
  )
}

export interface ListRowFoldButtonProps extends Omit<
  ButtonProps,
  'variant' | 'children' | 'className' | 'size'
> {
  className?: string
  expanded: boolean
}

export function ListRowFoldButton({
  className,
  expanded,
  ...props
}: ListRowFoldButtonProps) {
  return (
    <Button
      {...props}
      variant="ghost"
      className={styles.ListRowFoldButton(styler.merge({className}))}
      size="icon-sm"
    >
      <FoldIcon
        aria-hidden
        className={styles.ListRowFoldButton.icon()}
        expanded={expanded}
      />
    </Button>
  )
}

export interface ListRowBodyProps extends ComponentPropsWithoutRef<'div'> {}

export function ListRowBody({className, ...props}: ListRowBodyProps) {
  return (
    <div {...props} className={styles.ListRowBody(styler.merge({className}))} />
  )
}

export interface ListRowFooterProps extends ComponentPropsWithoutRef<'div'> {}

export function ListRowFooter({className, ...props}: ListRowFooterProps) {
  return (
    <div
      {...props}
      className={styles.ListRowFooter(styler.merge({className}))}
    />
  )
}

export interface ListRowSettingsProps extends ComponentPropsWithoutRef<'div'> {
  actions?: boolean
}

export function ListRowSettings({
  actions,
  className,
  ...props
}: ListRowSettingsProps) {
  return (
    <div
      {...props}
      className={styles.ListRowSettings(styler.merge({className}))}
      data-actions={actions || undefined}
    />
  )
}

export interface ListDragPreviewProps extends ComponentPropsWithoutRef<'div'> {
  icon?: ComponentType
  label: ReactNode
}

export function ListDragPreview({
  className,
  icon,
  label,
  ...props
}: ListDragPreviewProps) {
  return (
    <div
      {...props}
      className={styles.ListDragPreview(styler.merge({className}))}
    >
      {icon && (
        <div className={styles.ListDragPreview.icon()}>
          <Icon aria-hidden icon={icon} />
        </div>
      )}
      <div className={styles.ListDragPreview.body()}>
        <strong className={styles.ListDragPreview.title()}>{label}</strong>
      </div>
    </div>
  )
}
