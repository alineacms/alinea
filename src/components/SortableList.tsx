import styler from '@alinea/styler'
import {
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
  createContext,
  type PointerEvent,
  useContext,
  useMemo,
  useRef
} from 'react'
import {flushSync} from 'react-dom'
import {
  IcRoundAdd,
  IcRoundDragIndicator,
  IcRoundMoreHoriz,
  IcRoundUnfoldLess,
  IcRoundUnfoldMore
} from '#/dashboard/icons.js'
import {Button, type ButtonProps} from './Button.js'
import {Icon} from './Icon.js'
import {pressSortableItem} from './internal/sortableDrag.js'
import css from './SortableList.module.css'
import type {DragMoveEvent, Key} from './types.js'

const styles = styler(css)

interface SortableListContextValue {
  /** Registers the element of a reorderable item */
  register(key: Key, element: HTMLElement | null): void
  press(key: Key, event: PointerEvent<HTMLElement>): void
  /** Moves the item one place up or down */
  step(key: Key, direction: -1 | 1): boolean
}

const SortableListContext = createContext<SortableListContextValue | null>(null)

/** The key of a reorderable item, for its header */
const SortableListItemContext = createContext<Key | null>(null)

export interface SortableListProps extends ComponentPropsWithoutRef<'div'> {
  /**
   * Enables reordering: items with an `id` follow the pointer when their
   * `SortableListItemHeader` is dragged, the other items move aside as it
   * passes them. With focus in the header, Alt+ArrowUp and Alt+ArrowDown
   * move an item. Called with the key of the moved item and the item it was
   * dropped before or after. Update the order synchronously: the dropped item
   * glides into the place it renders in right after this returns.
   */
  onReorder?: (event: DragMoveEvent) => void
}

export function SortableList({
  className,
  role = 'list',
  onReorder,
  ...props
}: SortableListProps) {
  const ref = useRef<HTMLDivElement>(null)
  const keys = useRef(new Map<HTMLElement, Key>())
  const reorderRef = useRef(onReorder)
  reorderRef.current = onReorder
  const reorderable = Boolean(onReorder)
  const context = useMemo<SortableListContextValue | null>(() => {
    if (!reorderable) return null
    function items() {
      const list = ref.current
      if (!list) return []
      return Array.from(list.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && keys.current.has(child)
      )
    }
    function element(key: Key) {
      for (const [element, current] of keys.current)
        if (current === key) return element
    }
    function move(
      item: HTMLElement,
      target: HTMLElement,
      position: 'before' | 'after'
    ) {
      const key = keys.current.get(item)
      const targetKey = keys.current.get(target)
      // Either one left the list while the item was dragged
      if (key === undefined || targetKey === undefined) return
      // Renders the new order before the dragged item settles into it
      flushSync(() =>
        reorderRef.current?.({
          keys: new Set([key]),
          target: {key: targetKey, position}
        })
      )
    }
    return {
      register(key, element) {
        for (const [current, value] of keys.current)
          if (value === key) keys.current.delete(current)
        if (element) keys.current.set(element, key)
      },
      press(key, event) {
        const list = ref.current
        const item = element(key)
        if (!list || !item) return
        pressSortableItem({
          event: event.nativeEvent,
          list,
          item,
          items,
          onDrop: move
        })
      },
      step(key, direction) {
        const item = element(key)
        if (!item) return false
        const elements = items()
        const from = elements.indexOf(item)
        const to = from + direction
        if (from === -1 || to < 0 || to >= elements.length) return false
        const focused = document.activeElement
        move(item, elements[to], direction > 0 ? 'after' : 'before')
        // Moving the element in the document can drop its focus
        if (
          focused instanceof HTMLElement &&
          focused !== document.activeElement
        )
          focused.focus()
        return true
      }
    }
  }, [reorderable])
  return (
    <SortableListContext.Provider value={context}>
      <div
        data-slot="sortable-list"
        {...props}
        className={styles.SortableList(styler.merge({className}))}
        data-reorderable={reorderable || undefined}
        ref={ref}
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
  /** Highlights the item, eg. while its settings are open next to the list */
  current?: boolean
}

export function SortableListItem({
  id,
  className,
  current,
  ...props
}: SortableListItemProps) {
  const list = useContext(SortableListContext)
  const key = list && id !== undefined ? id : null
  return (
    <SortableListItemContext.Provider value={key}>
      <div
        data-slot="sortable-list-item"
        role="listitem"
        {...props}
        aria-current={current || undefined}
        aria-keyshortcuts={
          key === null ? undefined : 'Alt+ArrowUp Alt+ArrowDown'
        }
        className={styles.SortableListItem(styler.merge({className}))}
        ref={key === null ? undefined : element => list?.register(key, element)}
      />
    </SortableListItemContext.Provider>
  )
}

export interface SortableListItemHeaderProps extends ComponentPropsWithoutRef<'div'> {}

/**
 * Top bar of an item, holds its title and actions. Drags the item when the
 * list has `onReorder`, a press that does not move still clicks.
 */
export function SortableListItemHeader({
  className,
  onPointerDownCapture,
  onKeyDown,
  onDragStart,
  ...props
}: SortableListItemHeaderProps) {
  const list = useContext(SortableListContext)
  const key = useContext(SortableListItemContext)
  return (
    <div
      data-slot="sortable-list-item-header"
      {...props}
      className={styles.SortableListItemHeader(styler.merge({className}))}
      data-reorderable={(list !== null && key !== null) || undefined}
      // Captured, the buttons in the header stop the press from bubbling
      onPointerDownCapture={event => {
        onPointerDownCapture?.(event)
        if (!list || key === null) return
        // Touch scrolls the page, items move with their settings there
        if (event.button !== 0 || event.pointerType === 'touch') return
        // Menus open as the press starts, moving then picks from them
        const target = event.target as Element
        if (target.closest('[aria-haspopup="menu"], [aria-haspopup="listbox"]'))
          return
        list.press(key, event)
      }}
      onKeyDown={event => {
        onKeyDown?.(event)
        if (!list || key === null || event.defaultPrevented) return
        if (!event.altKey) return
        const direction =
          event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
        if (direction && list.step(key, direction)) event.preventDefault()
      }}
      onDragStart={event => {
        onDragStart?.(event)
        // Images and links in the header would start a native drag instead
        if (list && key !== null) event.preventDefault()
      }}
    />
  )
}

export interface SortableListItemHandleProps extends Omit<
  ComponentPropsWithoutRef<'button'>,
  'children' | 'type'
> {}

/**
 * Drags its item, for items without a header to drag, eg. a row that is an
 * input. Renders nothing while the list cannot be reordered.
 */
export function SortableListItemHandle({
  className,
  onPointerDown,
  onKeyDown,
  ...props
}: SortableListItemHandleProps) {
  const list = useContext(SortableListContext)
  const key = useContext(SortableListItemContext)
  if (!list || key === null) return null
  return (
    <button
      data-slot="sortable-list-item-handle"
      type="button"
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      {...props}
      className={styles.SortableListItemHandle(styler.merge({className}))}
      onPointerDown={event => {
        onPointerDown?.(event)
        if (event.button !== 0 || event.pointerType === 'touch') return
        list.press(key, event)
      }}
      onKeyDown={event => {
        onKeyDown?.(event)
        if (event.defaultPrevented || !event.altKey) return
        const direction =
          event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
        if (direction && list.step(key, direction)) event.preventDefault()
      }}
    >
      <Icon aria-hidden icon={IcRoundDragIndicator} />
    </button>
  )
}

export interface SortableListItemTitleProps extends ComponentPropsWithoutRef<'div'> {}

/** Row of the toggle, badges and description of an item, fills the header */
export function SortableListItemTitle({
  className,
  ...props
}: SortableListItemTitleProps) {
  return (
    <div
      data-slot="sortable-list-item-title"
      {...props}
      className={styles.SortableListItemTitle(styler.merge({className}))}
    />
  )
}

export interface SortableListItemTriggerProps extends Omit<
  ButtonProps,
  'variant' | 'size' | 'icon' | 'asChild'
> {
  /** Ends the button with a "…", defaults to true */
  more?: boolean
}

/**
 * The badges and description of an item as one button that ends in a "…",
 * eg. to open the settings of the item. Fills the title up to the actions.
 */
export function SortableListItemTrigger({
  className,
  more = true,
  children,
  ...props
}: SortableListItemTriggerProps) {
  return (
    <Button
      data-slot="sortable-list-item-trigger"
      {...props}
      variant="ghost"
      className={styles.SortableListItemTrigger(styler.merge({className}))}
    >
      {children}
      {more && (
        <span
          data-slot="sortable-list-item-more"
          className={styles.SortableListItemTrigger.more()}
        >
          <Icon aria-hidden icon={IcRoundMoreHoriz} />
        </span>
      )}
    </Button>
  )
}

export interface SortableListItemInsertProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'children'
> {}

/**
 * Inserts an item before the one it is placed in: a line with an add button
 * that shows when the pointer is on the border above the item. Place it first
 * in the `SortableListItem`.
 */
export function SortableListItemInsert({
  className,
  ...props
}: SortableListItemInsertProps) {
  return (
    <div
      data-slot="sortable-list-item-insert"
      className={styles.SortableListItemInsert(styler.merge({className}))}
    >
      <button
        type="button"
        data-slot="sortable-list-item-insert-button"
        {...props}
        className={styles.SortableListItemInsert.button()}
      >
        <Icon aria-hidden icon={IcRoundAdd} />
      </button>
    </div>
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
  'variant' | 'children' | 'size'
> {
  /** Whether the item content is shown, picks the unfold icon */
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
      icon={expanded ? IcRoundUnfoldLess : IcRoundUnfoldMore}
    />
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
