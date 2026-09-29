import styler from '@alinea/styler'
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import {useInteractOutside} from 'react-aria'
import {
  Dialog,
  DialogTrigger,
  OverlayTriggerStateContext,
  PopoverContext,
  useSlottedContext
} from 'react-aria-components'
import {placement} from './internal/Placement.js'
import {PopoverSurface} from './internal/PopoverSurface.js'
import {Slot} from './internal/Slot.js'
import {
  OptionalTrigger,
  Trigger,
  type TriggerProps
} from './internal/Trigger.js'
import css from './Popover.module.css'
import type {
  AriaProps,
  DataProps,
  OpenStateProps,
  PositionProps,
  StyleProps
} from './types.js'

const styles = styler(css)

interface PopoverContextValue {
  modal: boolean
  anchor: RefObject<Element | null> | null
  setAnchor: (anchor: RefObject<Element | null> | null) => void
}

const PopoverStateContext = createContext<PopoverContextValue>({
  modal: true,
  anchor: null,
  setAnchor() {}
})

export interface PopoverProps extends OpenStateProps {
  /**
   * Whether interaction outside the popover is blocked while it is open.
   * Defaults to true.
   */
  modal?: boolean
  children: ReactNode
}

export function Popover({
  open,
  defaultOpen,
  onOpenChange,
  modal = true,
  children
}: PopoverProps) {
  const [anchor, setAnchor] = useState<RefObject<Element | null> | null>(null)
  return (
    <PopoverStateContext.Provider value={{modal, anchor, setAnchor}}>
      <DialogTrigger
        isOpen={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
      >
        <OptionalTrigger />
        {children}
      </DialogTrigger>
    </PopoverStateContext.Provider>
  )
}

export interface PopoverTriggerProps extends TriggerProps {}

export function PopoverTrigger(props: PopoverTriggerProps) {
  return <Trigger data-slot="popover-trigger" {...props} />
}

export interface PopoverAnchorProps extends StyleProps, DataProps {
  /** Render the child element as the anchor instead of a div */
  asChild?: boolean
  /**
   * Position against an element rendered elsewhere, the anchor then renders
   * only its children (if any)
   */
  virtualRef?: RefObject<Element | null>
  children?: ReactNode
}

/**
 * Positions the PopoverContent against this element instead of the
 * PopoverTrigger
 */
export function PopoverAnchor({
  asChild,
  virtualRef,
  className,
  children,
  ...props
}: PopoverAnchorProps) {
  const {setAnchor} = useContext(PopoverStateContext)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    setAnchor(virtualRef ?? ref)
    return () => setAnchor(null)
  }, [setAnchor, virtualRef])
  if (virtualRef) return children
  if (asChild)
    return (
      <Slot
        data-slot="popover-anchor"
        {...props}
        ref={ref}
        className={className}
      >
        {children}
      </Slot>
    )
  return (
    <div data-slot="popover-anchor" {...props} ref={ref} className={className}>
      {children}
    </div>
  )
}

export interface PopoverContentProps
  extends StyleProps, AriaProps, DataProps, PositionProps {
  /**
   * Called on a click outside of the popover, call `event.preventDefault()`
   * to keep the popover open. The page is covered while a modal popover is
   * open, so `event.target` is that cover rather than the element below it.
   */
  onInteractOutside?: (event: Event) => void
  children: ReactNode
}

export function PopoverContent({
  side,
  align,
  sideOffset,
  alignOffset,
  onInteractOutside,
  className,
  style,
  children,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  ...props
}: PopoverContentProps) {
  const {modal, anchor} = useContext(PopoverStateContext)
  const state = useContext(OverlayTriggerStateContext)
  const trigger = useSlottedContext(PopoverContext)?.triggerRef
  const ref = useRef<HTMLElement>(null)
  // The trigger toggles the popover itself, and overlays portaled after this
  // one were opened from it (a Select, a Dialog), so neither is outside
  const isInside = (target: EventTarget | null) =>
    target instanceof Node &&
    Boolean(
      trigger?.current?.contains(target) ||
      (ref.current &&
        ref.current.compareDocumentPosition(target) &
          Node.DOCUMENT_POSITION_FOLLOWING)
    )
  // Dismiss here rather than through react-aria, which asks twice per click
  // and only sees the underlay covering the page of a modal popover
  useInteractOutside({
    ref,
    isDisabled: !state?.isOpen,
    onInteractOutside(event) {
      if (isInside(event.target)) return
      onInteractOutside?.(event)
      if (!event.defaultPrevented) state?.close()
    }
  })
  return (
    <PopoverSurface
      data-slot="popover-content"
      {...props}
      ref={ref}
      triggerRef={anchor ?? undefined}
      className={className}
      style={style}
      placement={placement(side, align)}
      offset={sideOffset}
      crossOffset={alignOffset}
      isNonModal={!modal}
      // react-aria still closes non-modal popovers when focus moves out
      shouldCloseOnInteractOutside={element => !modal && !isInside(element)}
    >
      <Dialog
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        className={styles.PopoverContent.dialog()}
      >
        {children}
      </Dialog>
    </PopoverSurface>
  )
}
