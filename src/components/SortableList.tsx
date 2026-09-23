import styler from '@alinea/styler'
import {
  type ComponentPropsWithoutRef,
  type ComponentType,
  createContext,
  type DOMAttributes,
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
import {Button, type ButtonProps} from './Button.js'
import {FoldIcon} from './FoldIcon.js'
import {Icon} from './Icon.js'
import css from './SortableList.module.css'
import {Surface, type SurfaceProps} from './Surface.js'
import type {DragMoveEvent, DropTarget, Key} from './types.js'

const styles = styler(css)

const DEFAULT_DRAG_TYPE = 'alinea/sortable-list-item'

type ItemDropPosition = 'before' | 'after'

interface ItemDropTarget extends DropTarget {
  position: ItemDropPosition
}

interface SortableListContextValue {
  dragType: string
  draggingKey: Key | null
  dropTarget: ItemDropTarget | null
  /** Whether the current drag was started with a pointer (native drag) */
  pointerDrag: RefObject<boolean>
  /** Element of the dragged item */
  source: RefObject<HTMLElement | null>
  startDrag(key: Key, item: HTMLElement | null, pointer: boolean): void
  endDrag(): void
  setDropTarget(target: ItemDropTarget | null, exit?: boolean): void
  drop(target: ItemDropTarget): void
}

const SortableListContext = createContext<SortableListContextValue | null>(null)

interface SortableListItemContextValue {
  dragProps: DOMAttributes<HTMLElement>
  dragging: boolean
  handle: RefObject<HTMLSpanElement>
}

const SortableListItemContext =
  createContext<SortableListItemContextValue | null>(null)

export interface SortableListProps extends SurfaceProps {
  /**
   * Enables reordering: items with an `id` can be dragged by their
   * `SortableListHandle`, with a pointer or with the keyboard (Enter on the
   * handle, Tab to an item, Enter to drop). Called with the key of the dragged
   * item and the item it was dropped before or after.
   * Items only drop within the list they were dragged from.
   */
  onReorder?: (event: DragMoveEvent) => void
  /** Mime type the dragged items carry, defaults to `alinea/sortable-list-item` */
  dragType?: string
}

export function SortableList({
  className,
  role = 'list',
  onReorder,
  dragType = DEFAULT_DRAG_TYPE,
  ...props
}: SortableListProps) {
  const [draggingKey, setDraggingKey] = useState<Key | null>(null)
  const [dropTarget, setDropTargetState] = useState<ItemDropTarget | null>(null)
  const pointerDrag = useRef(false)
  const source = useRef<HTMLElement | null>(null)
  const dragged = useRef<Key | null>(null)
  const reorderRef = useRef(onReorder)
  reorderRef.current = onReorder
  const reorderable = Boolean(onReorder)
  const context = useMemo<SortableListContextValue | null>(() => {
    if (!reorderable) return null
    return {
      dragType,
      draggingKey,
      dropTarget,
      pointerDrag,
      source,
      startDrag(key, item, pointer) {
        dragged.current = key
        source.current = item
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
          // Only clear the target if it was not replaced by another item yet
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
    <SortableListContext.Provider value={context}>
      <Surface
        data-slot="sortable-list"
        {...props}
        className={className}
        role={role}
      />
    </SortableListContext.Provider>
  )
}

export interface SortableListItemProps extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'id'
> {
  /**
   * Identifies the item within its list. Items with an id can be dragged when
   * the list has `onReorder`. The id is not rendered as a DOM id.
   */
  id?: Key
  /** Rendered under the pointer while dragging, eg. a `SortableListDragPreview` */
  dragPreview?: ReactNode
}

export function SortableListItem({
  id,
  dragPreview,
  ...props
}: SortableListItemProps) {
  const list = useContext(SortableListContext)
  if (list && id !== undefined)
    return (
      <ReorderableItem
        {...props}
        dragPreview={dragPreview}
        id={id}
        list={list}
      />
    )
  return (
    <SortableListItemContext.Provider value={null}>
      <SortableListItemElement {...props} />
    </SortableListItemContext.Provider>
  )
}

interface SortableListItemElementProps extends Omit<
  SortableListItemProps,
  'id' | 'dragPreview'
> {
  dragging?: boolean
}

function SortableListItemElement({
  className,
  dragging,
  ...props
}: SortableListItemElementProps) {
  return (
    <div
      data-slot="sortable-list-item"
      {...props}
      className={styles.SortableListItem(styler.merge({className}))}
      data-dragging={dragging || undefined}
    />
  )
}

interface ReorderableItemProps extends Omit<SortableListItemProps, 'id'> {
  id: Key
  list: SortableListContextValue
}

function ReorderableItem({
  id,
  list,
  dragPreview,
  children,
  ...props
}: ReorderableItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLSpanElement>(null)
  const preview = useRef<DragPreviewRenderer | null>(null)
  const nativeDrag = useRef(false)
  const {dragType, draggingKey, dropTarget} = list
  const {dragProps, isDragging} = useDrag({
    getItems() {
      return [{'text/plain': String(id), [dragType]: String(id)}]
    },
    getAllowedDropOperations() {
      return ['move']
    },
    onDragStart() {
      list.startDrag(id, ref.current, nativeDrag.current)
    },
    onDragEnd() {
      const keyboard = !nativeDrag.current
      nativeDrag.current = false
      list.endDrag()
      // Keep keyboard focus on the moved item
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
  function dropPosition(y: number): ItemDropPosition {
    const item = ref.current
    if (!item) return 'after'
    if (!list.pointerDrag.current) {
      // Keyboard drops take the place of the target item
      const source = list.source.current
      if (!source || source === item) return 'after'
      const sourceFollows =
        item.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING
      return sourceFollows ? 'before' : 'after'
    }
    return y < item.offsetHeight / 2 ? 'before' : 'after'
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
      list.setDropTarget({key: id, position: dropPosition(event.y)})
    },
    onDropMove(event) {
      list.setDropTarget({key: id, position: dropPosition(event.y)})
    },
    onDropExit() {
      list.setDropTarget({key: id, position: 'after'}, true)
    },
    onDrop(event) {
      list.drop({key: id, position: dropPosition(event.y)})
    }
  })
  const active = dropTarget?.key === id ? dropTarget.position : undefined
  const itemContext = useMemo<SortableListItemContextValue>(
    () => ({dragProps: handleDragProps, dragging: isDragging, handle}),
    [handleDragProps, isDragging]
  )
  return (
    <SortableListItemContext.Provider value={itemContext}>
      <div
        {...dropProps}
        className={styles.SortableListItem.dropTarget()}
        data-slot="sortable-list-item-drop-target"
        ref={ref}
        tabIndex={draggingKey !== null ? -1 : undefined}
      >
        <SortableListItemElement {...props} dragging={isDragging}>
          {dragPreview && (
            <DragPreview ref={preview}>{() => <>{dragPreview}</>}</DragPreview>
          )}
          {children}
        </SortableListItemElement>
        <div
          aria-hidden
          className={styles.SortableListItem.dropIndicator()}
          data-active={active === 'before' || undefined}
          data-position="before"
          data-slot="sortable-list-drop-indicator"
        />
        <div
          aria-hidden
          className={styles.SortableListItem.dropIndicator()}
          data-active={active === 'after' || undefined}
          data-position="after"
          data-slot="sortable-list-drop-indicator"
        />
      </div>
    </SortableListItemContext.Provider>
  )
}

export interface SortableListItemHeaderProps extends ComponentPropsWithoutRef<'div'> {}

/** Top bar of an item, holds its handle, title and actions */
export function SortableListItemHeader({
  className,
  ...props
}: SortableListItemHeaderProps) {
  return (
    <div
      data-slot="sortable-list-item-header"
      {...props}
      className={styles.SortableListItemHeader(styler.merge({className}))}
    />
  )
}

export interface SortableListHandleProps extends ComponentPropsWithoutRef<'span'> {}

/**
 * Drags its `SortableListItem` when the list has `onReorder`. Focusable in
 * that case: press Enter to start a keyboard drag. Place it in the
 * `SortableListItemHeader`, it shows while the header is hovered or focused.
 */
export function SortableListHandle({
  className,
  ...props
}: SortableListHandleProps) {
  const item = useContext(SortableListItemContext)
  if (!item)
    return (
      <span
        data-slot="sortable-list-handle"
        {...props}
        className={styles.SortableListHandle(styler.merge({className}))}
      />
    )
  return (
    <span
      data-slot="sortable-list-handle"
      role="button"
      tabIndex={0}
      {...mergeProps(props, item.dragProps)}
      className={styles.SortableListHandle(styler.merge({className}))}
      data-dragging={item.dragging || undefined}
      ref={item.handle}
    />
  )
}

export interface SortableListItemTitleProps extends ComponentPropsWithoutRef<'div'> {}

/** Row of the toggle, badges and description of an item, fills the header */
export function SortableListItemTitle({
  className,
  ...props
}: SortableListItemTitleProps) {
  const item = useContext(SortableListItemContext)
  return (
    <div
      data-slot="sortable-list-item-title"
      {...props}
      className={styles.SortableListItemTitle(styler.merge({className}))}
      data-dragging={item?.dragging || undefined}
    />
  )
}

export interface SortableListItemDescriptionProps extends ComponentPropsWithoutRef<'span'> {}

/** Muted, truncated text next to the badges of an item, eg. its label */
export function SortableListItemDescription({
  className,
  ...props
}: SortableListItemDescriptionProps) {
  return (
    <span
      data-slot="sortable-list-item-description"
      {...props}
      className={styles.SortableListItemDescription(styler.merge({className}))}
    />
  )
}

export interface SortableListItemActionsProps extends ComponentPropsWithoutRef<'div'> {}

export function SortableListItemActions({
  className,
  ...props
}: SortableListItemActionsProps) {
  return (
    <div
      data-slot="sortable-list-item-actions"
      {...props}
      className={styles.SortableListItemActions(styler.merge({className}))}
    />
  )
}

export interface SortableListItemToggleProps extends Omit<
  ButtonProps,
  'variant' | 'children' | 'className' | 'size'
> {
  className?: string
  /** Whether the item content is shown, rotates the fold icon */
  expanded: boolean
}

/** Folds the content of an item */
export function SortableListItemToggle({
  className,
  expanded,
  ...props
}: SortableListItemToggleProps) {
  return (
    <Button
      data-slot="sortable-list-item-toggle"
      aria-expanded={expanded}
      {...props}
      variant="ghost"
      className={styles.SortableListItemToggle(styler.merge({className}))}
      size="icon-sm"
    >
      <FoldIcon
        aria-hidden
        className={styles.SortableListItemToggle.icon()}
        expanded={expanded}
      />
    </Button>
  )
}

export interface SortableListItemContentProps extends ComponentPropsWithoutRef<'div'> {}

/** The fields of an expanded item */
export function SortableListItemContent({
  className,
  ...props
}: SortableListItemContentProps) {
  return (
    <div
      data-slot="sortable-list-item-content"
      {...props}
      className={styles.SortableListItemContent(styler.merge({className}))}
    />
  )
}

export interface SortableListItemFooterProps extends ComponentPropsWithoutRef<'div'> {}

/** A summary under the header, eg. of a folded item */
export function SortableListItemFooter({
  className,
  ...props
}: SortableListItemFooterProps) {
  return (
    <div
      data-slot="sortable-list-item-footer"
      {...props}
      className={styles.SortableListItemFooter(styler.merge({className}))}
    />
  )
}

export interface SortableListItemSettingsProps extends ComponentPropsWithoutRef<'div'> {
  /** `actions` removes the padding around a group of ghost buttons */
  variant?: 'default' | 'actions'
}

/** A group of settings or actions in the popover of an item */
export function SortableListItemSettings({
  variant = 'default',
  className,
  ...props
}: SortableListItemSettingsProps) {
  return (
    <div
      data-slot="sortable-list-item-settings"
      {...props}
      className={styles.SortableListItemSettings(styler.merge({className}))}
      data-variant={variant}
    />
  )
}

export interface SortableListDragPreviewProps extends ComponentPropsWithoutRef<'div'> {
  icon?: ComponentType
  label: ReactNode
}

/** Card shown under the pointer while dragging an item */
export function SortableListDragPreview({
  className,
  icon,
  label,
  ...props
}: SortableListDragPreviewProps) {
  return (
    <div
      data-slot="sortable-list-drag-preview"
      {...props}
      className={styles.SortableListDragPreview(styler.merge({className}))}
    >
      {icon && (
        <div className={styles.SortableListDragPreview.icon()}>
          <Icon aria-hidden icon={icon} />
        </div>
      )}
      <div className={styles.SortableListDragPreview.body()}>
        <strong className={styles.SortableListDragPreview.title()}>
          {label}
        </strong>
      </div>
    </div>
  )
}

export interface SortableListAddProps extends ComponentPropsWithoutRef<'div'> {}

/** Last row of the list holding the buttons that add items */
export function SortableListAdd({
  children,
  className,
  ...props
}: SortableListAddProps) {
  return (
    <div
      data-slot="sortable-list-add"
      {...props}
      className={styles.SortableListAdd(styler.merge({className}))}
    >
      <div className={styles.SortableListAdd.inner()}>{children}</div>
    </div>
  )
}
