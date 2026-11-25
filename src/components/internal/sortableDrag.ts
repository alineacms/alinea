/** Distance the pointer moves before a press on an item becomes a drag */
const threshold = 4
/** Duration of the items moving aside and the dropped item settling */
const duration = 200
const easing = 'cubic-bezier(0.2, 0, 0, 1)'
/** Distance from the edge of the scroll container that scrolls it */
const scrollEdge = 48
const scrollSpeed = 12

export interface SortableDragOptions {
  /** The pointerdown on the item that may start the drag */
  event: PointerEvent
  list: HTMLElement
  item: HTMLElement
  /** The item elements of the list, in order */
  items(): Array<HTMLElement>
  /**
   * Moves `item` before or after `target`. Must render the new order before
   * it returns, so the items swap places without a frame in between.
   */
  onDrop(
    item: HTMLElement,
    target: HTMLElement,
    position: 'before' | 'after'
  ): void
  /** Other lists the item can move into, eg. nested in an item of the list */
  lists?: Array<SortableDropList>
  /** Moves `item` into one of `lists`, at this index among its items */
  onMove?(list: HTMLElement, index: number): void
}

export interface SortableDropList {
  element: HTMLElement
  items(): Array<HTMLElement>
}

/** Finishes the glide of items that were just dropped, keyed by element */
const settling = new Map<HTMLElement, () => void>()

/**
 * Lets the item follow the pointer once it moves past a small threshold,
 * while the other items move aside to show where it lands. Drops on release,
 * Escape cancels.
 */
export function pressSortableItem({
  event,
  list,
  item,
  items,
  onDrop,
  lists = [],
  onMove
}: SortableDragOptions) {
  const startX = event.clientX
  const startY = event.clientY
  let pointerX = startX
  let pointerY = startY
  let drag: ActiveDrag | null = null

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    pointerX = event.clientX
    pointerY = event.clientY
    if (!drag) {
      const distance = Math.hypot(pointerX - startX, pointerY - startY)
      if (distance < threshold) return
      drag = startDrag()
      if (!drag) return finish(false)
    }
    drag.update()
  }
  function onUp(event: PointerEvent) {
    if (event.pointerId === pointerId) finish(true)
  }
  function onCancel(event: PointerEvent) {
    if (event.pointerId === pointerId) finish(false)
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !drag) return
    event.preventDefault()
    event.stopPropagation()
    finish(false)
  }
  function onBlur() {
    finish(false)
  }
  const pointerId = event.pointerId
  // Captured, so a handler that stops the events can not leave a drag running
  window.addEventListener('pointermove', onPointerMove, true)
  window.addEventListener('pointerup', onUp, true)
  window.addEventListener('pointercancel', onCancel, true)
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('blur', onBlur)

  function finish(commit: boolean) {
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', onUp, true)
    window.removeEventListener('pointercancel', onCancel, true)
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('blur', onBlur)
    if (!drag) return
    drag.end(commit)
    drag = null
    // The release ends a press, so it should not click what is under the
    // pointer. Buttons that saw the press click themselves after the native
    // click, so this blocks the clicks in the list for a moment.
    const block = (event: MouseEvent) => {
      if (!(event.target instanceof Node) || !list.contains(event.target))
        return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('click', block, true)
    setTimeout(() => window.removeEventListener('click', block, true), 100)
  }

  function startDrag(): ActiveDrag | null {
    // Items that are still gliding into place are measured where they land
    for (const settle of Array.from(settling.values())) settle()
    const elements = items()
    const from = elements.indexOf(item)
    // Only direct children of the list move
    if (from === -1) return null
    const rects = elements.map(element => element.getBoundingClientRect())
    const scroller = scrollParent(list)
    const startScroll = scroller.scrollTop
    const others = elements.filter(element => element !== item)
    // A list in the item moves along with it
    const targets = lists.filter(list => !item.contains(list.element))
    let to = from
    let over: {list: SortableDropList; index: number} | undefined
    let marked: Array<HTMLElement> = []
    let frame = 0
    const userSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    // Shows the grabbing hand over everything, see SortableList.module.css
    document.documentElement.dataset.sortableDragging = ''
    window.getSelection()?.removeAllRanges()
    list.dataset.dragging = ''
    item.dataset.dragging = ''
    for (const other of others)
      other.style.transition = `transform ${duration}ms ${easing}`

    function offset() {
      const dy = pointerY - startY + scroller.scrollTop - startScroll
      if (over) return dy
      // Stays within the list
      const min = rects[0].top - rects[from].top
      const max = rects[rects.length - 1].bottom - rects[from].bottom
      return Math.min(max, Math.max(min, dy))
    }
    // The innermost list under the pointer, when it is another one
    function target() {
      const under = [list, ...targets.map(target => target.element)].filter(
        element => {
          const rect = element.getBoundingClientRect()
          return (
            pointerX >= rect.left &&
            pointerX <= rect.right &&
            pointerY >= rect.top &&
            pointerY <= rect.bottom
          )
        }
      )
      const inner = under.find(element =>
        under.every(other => other === element || !element.contains(other))
      )
      const found = targets.find(target => target.element === inner)
      if (!found) return undefined
      const index = found
        .items()
        .filter(
          element => pointerY > middle(element.getBoundingClientRect())
        ).length
      return {list: found, index}
    }
    // Shows where the item lands in another list: the list, and a line
    // between its items
    function mark() {
      for (const element of marked) delete element.dataset.drop
      marked = []
      if (!over) return
      const next = over.list.items()
      const at = next[over.index] ?? next.at(-1)
      over.list.element.dataset.drop = ''
      marked.push(over.list.element)
      if (!at) return
      at.dataset.drop = over.index < next.length ? 'before' : 'after'
      marked.push(at)
    }
    function update() {
      over = target()
      mark()
      const dy = offset()
      item.style.transform = `translateY(${dy}px)`
      const top = rects[from].top + dy
      const bottom = rects[from].bottom + dy
      to = from
      for (let index = from - 1; index >= 0; index--)
        if (top < middle(rects[index])) to = index
      for (let index = from + 1; index < rects.length; index++)
        if (bottom > middle(rects[index])) to = index
      // Leaves its place open while it is over another list
      if (over) to = from
      const size = rects[from].height
      elements.forEach((element, index) => {
        if (element === item) return
        const shift =
          from < to && index > from && index <= to
            ? -size
            : to < from && index >= to && index < from
              ? size
              : 0
        element.style.transform = shift ? `translateY(${shift}px)` : ''
      })
    }
    function autoScroll() {
      const bounds = scrollBounds(scroller)
      const step =
        pointerY < bounds.top + scrollEdge
          ? -scrollSpeed
          : pointerY > bounds.bottom - scrollEdge
            ? scrollSpeed
            : 0
      if (step) {
        const before = scroller.scrollTop
        scroller.scrollTop += step
        if (scroller.scrollTop !== before) update()
      }
      frame = requestAnimationFrame(autoScroll)
    }
    frame = requestAnimationFrame(autoScroll)

    function end(commit: boolean) {
      cancelAnimationFrame(frame)
      document.body.style.userSelect = userSelect
      delete document.documentElement.dataset.sortableDragging
      for (const element of marked) delete element.dataset.drop
      if (commit && over && onMove) {
        // The item renders in the other list from here
        for (const other of others) {
          other.style.transition = ''
          other.style.transform = ''
        }
        item.style.transform = ''
        delete item.dataset.dragging
        delete list.dataset.dragging
        onMove(over.list.element, over.index)
        return
      }
      const moved = commit && to !== from
      for (const other of others) {
        // The new order puts them in place at once, otherwise they move back
        if (moved) other.style.transition = ''
        other.style.transform = ''
      }
      const visualTop = item.getBoundingClientRect().top
      item.style.transform = ''
      if (moved) onDrop(item, elements[to], to > from ? 'after' : 'before')
      // Glides from where it was let go into its place
      const distance = visualTop - item.getBoundingClientRect().top
      item.style.transition = 'none'
      item.style.transform = `translateY(${distance}px)`
      item.getBoundingClientRect()
      item.style.transition = `transform ${duration}ms ${easing}`
      item.style.transform = ''
      delete list.dataset.dragging
      const timeout = setTimeout(settle, duration)
      function settle() {
        clearTimeout(timeout)
        settling.delete(item)
        item.style.transition = ''
        for (const other of others) other.style.transition = ''
        delete item.dataset.dragging
      }
      settling.set(item, settle)
    }

    return {update, end}
  }
}

interface ActiveDrag {
  update(): void
  end(commit: boolean): void
}

function middle(rect: DOMRect) {
  return rect.top + rect.height / 2
}

function scrollParent(element: HTMLElement): HTMLElement {
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const {overflowY} = getComputedStyle(parent)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      parent.scrollHeight > parent.clientHeight
    )
      return parent
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement
}

function scrollBounds(scroller: HTMLElement) {
  if (scroller === document.scrollingElement)
    return {top: 0, bottom: window.innerHeight}
  const rect = scroller.getBoundingClientRect()
  return {top: rect.top, bottom: rect.bottom}
}
