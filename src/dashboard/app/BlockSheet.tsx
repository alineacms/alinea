import type {StyleProps} from '#/components.js'
import {styler} from '@alinea/styler'
import {
  atom,
  type PrimitiveAtom,
  useAtomValueRaw,
  useStore,
  type WritableAtom
} from 'jotai'
import {
  createContext,
  type FocusEvent as ReactFocusEvent,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {createPortal} from 'react-dom'
import css from './BlockSheet.module.css'

const styles = styler(css)

interface BlockSheetContextValue {
  /** Id of the block whose sheet is open */
  open: WritableAtom<string | null, [SetStateAction<string | null>], void>
  /** Id of the block whose sheet animates out after closing */
  leaving: PrimitiveAtom<string | null>
  host: PrimitiveAtom<HTMLElement | null>
}

const BlockSheetContext = createContext<BlockSheetContextValue | null>(null)

const closed = atom(false)
const none = atom(null)
const exit = 150
const triggerAttribute = 'data-block-sheet-trigger'

function blockSheetContext(): BlockSheetContextValue {
  const current = atom<string | null>(null)
  const leaving = atom<string | null>(null)
  const open = atom(
    get => get(current),
    (get, set, next: SetStateAction<string | null>) => {
      const previous = get(current)
      const id = typeof next === 'function' ? next(previous) : next
      set(current, id)
      // Switching to another sheet replaces it at once, closing animates out
      const left = id === null ? previous : null
      set(leaving, left)
      if (left)
        setTimeout(() => set(leaving, now => (now === left ? null : now)), exit)
    }
  )
  return {open, leaving, host: atom<HTMLElement | null>(null)}
}

export interface BlockSheetProviderProps {
  children: ReactNode
}

/** Holds the block settings sheet of an entry editor, one open at a time */
export function BlockSheetProvider({children}: BlockSheetProviderProps) {
  const [context] = useState(blockSheetContext)
  return (
    <BlockSheetContext.Provider value={context}>
      {children}
    </BlockSheetContext.Provider>
  )
}

export interface BlockSheetBoundaryProps {
  children: ReactNode
}

/**
 * Fields inside have no block settings sheet, eg. in a modal that covers the
 * sidebar the sheet would open in
 */
export function BlockSheetBoundary({children}: BlockSheetBoundaryProps) {
  return (
    <BlockSheetContext.Provider value={null}>
      {children}
    </BlockSheetContext.Provider>
  )
}

export interface BlockSheetSlotProps extends StyleProps {}

/** Where the open sheet renders, covers its positioned container */
export function BlockSheetSlot({className, style}: BlockSheetSlotProps) {
  const context = useContext(BlockSheetContext)
  const store = useStore()
  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      if (context) store.set(context.host, element)
    },
    [context, store]
  )
  return (
    <div
      ref={ref}
      className={styles.BlockSheetSlot(styler.merge({className}))}
      style={style}
    />
  )
}

export interface BlockSheetTriggerProps {
  [triggerAttribute]: string
}

export interface BlockSheetState {
  /** False outside an entry editor, where there is no sidebar to cover */
  available: boolean
  open: boolean
  /**
   * Spread on the button that toggles the sheet, so moving focus to it
   * doesn't close the sheet before the toggle
   */
  triggerProps: BlockSheetTriggerProps
  setOpen(open: boolean): void
  toggle(): void
}

/** Open state of the sheet of block `id`, closed outside an entry editor */
export function useBlockSheet(id: string): BlockSheetState {
  const context = useContext(BlockSheetContext)
  const store = useStore()
  const open = useAtomValueRaw(
    useMemo(
      () => (context ? atom(get => get(context.open) === id) : closed),
      [context, id]
    )
  )
  // Closes the sheet of a block that is removed
  useEffect(() => {
    if (!context) return
    return () => {
      store.set(context.open, current => (current === id ? null : current))
    }
  }, [context, store, id])
  return {
    available: Boolean(context),
    open,
    triggerProps: {[triggerAttribute]: id},
    setOpen(open) {
      if (!context) return
      store.set(context.open, current =>
        open ? id : current === id ? null : current
      )
    },
    toggle() {
      if (!context) return
      store.set(context.open, current => (current === id ? null : id))
    }
  }
}

/** Whether any block sheet is open or still animating out */
export function useBlockSheetOpen(): boolean {
  const context = useContext(BlockSheetContext)
  return useAtomValueRaw(
    useMemo(
      () =>
        context
          ? atom(
              get => get(context.open) !== null || get(context.leaving) !== null
            )
          : closed,
      [context]
    )
  )
}

export interface BlockSheetProps {
  id: string
  children: ReactNode
}

/**
 * Renders the sheet of block `id` in the slot while it is open. A portal
 * keeps the sheet owned by its block, so its fields keep the block's node,
 * editor context, local state and callbacks.
 */
export function BlockSheet({id, children}: BlockSheetProps) {
  const context = useContext(BlockSheetContext)
  const store = useStore()
  const state = useAtomValueRaw(
    useMemo(
      () =>
        context
          ? atom(get =>
              get(context.open) === id
                ? 'open'
                : get(context.leaving) === id
                  ? 'closing'
                  : null
            )
          : none,
      [context, id]
    )
  )
  // Read with the state, the slot can mount before this subscribes
  const host = useAtomValueRaw(
    useMemo(
      () =>
        context
          ? atom(get =>
              get(context.open) === id || get(context.leaving) === id
                ? get(context.host)
                : null
            )
          : none,
      [context, id]
    )
  )
  const open = state === 'open'
  // Set while a focus event passes through the sheet in the React tree, which
  // includes popovers that its fields render in portals
  const focusInside = useRef(false)
  useEffect(() => {
    if (!context || !open) return
    const close = () =>
      store.set(context.open, current => (current === id ? null : current))
    // Focus moved somewhere else, a trigger toggles the sheet on its own
    const onFocusIn = (event: FocusEvent) => {
      const inside = focusInside.current
      focusInside.current = false
      if (inside) return
      const target = event.target
      if (target instanceof Element && target.closest(`[${triggerAttribute}]`))
        return
      close()
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [context, store, open, id])
  function onBlur(event: ReactFocusEvent) {
    if (!context || !open || event.relatedTarget) return
    // Focus went nowhere, eg. a click on a non focusable part of the page,
    // unless it lands back inside after the sheet swapped its content or the
    // window lost focus
    setTimeout(() => {
      const active = document.activeElement
      if (!document.hasFocus() || (active && active !== document.body)) return
      store.set(context.open, current => (current === id ? null : current))
    })
  }
  useEffect(() => {
    if (!context || !open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // A modal on top hides the rest of the page and handles its own Escape
      if (host?.closest('[inert], [aria-hidden="true"]')) return
      store.set(context.open, current => (current === id ? null : current))
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [context, store, host, open, id])
  if (!host || !state) return null
  return createPortal(
    <div
      className={styles.BlockSheet()}
      data-closing={!open || undefined}
      inert={!open}
      onFocusCapture={() => {
        focusInside.current = true
      }}
      onBlur={onBlur}
    >
      {children}
    </div>,
    host
  )
}
