import styler from '@alinea/styler'
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useContext,
  useId,
  useState
} from 'react'
import {FoldIcon} from './FoldIcon.js'
import css from './Collapsible.module.css'
import {Slot, type SlotProps} from './internal/Slot.js'
import type {AriaProps, DataProps, OpenStateProps, StyleProps} from './types.js'

const styles = styler(css)

interface CollapsibleContextValue {
  open: boolean
  disabled: boolean
  contentId: string
  toggle(): void
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null)

function useCollapsible(part: string) {
  const context = useContext(CollapsibleContext)
  if (!context) throw new Error(`${part} must be used within a Collapsible`)
  return context
}

export interface CollapsibleProps
  extends StyleProps, DataProps, OpenStateProps {
  disabled?: boolean
  id?: string
  children: ReactNode
}

/** A panel that expands and collapses its content */
export function Collapsible({
  open,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  children,
  ...props
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isOpen = open ?? uncontrolledOpen
  const contentId = useId()
  function toggle() {
    if (disabled) return
    if (open === undefined) setUncontrolledOpen(!isOpen)
    onOpenChange?.(!isOpen)
  }
  return (
    <CollapsibleContext.Provider
      value={{open: isOpen, disabled, contentId, toggle}}
    >
      <div
        data-slot="collapsible"
        {...props}
        data-state={isOpen ? 'open' : 'closed'}
        data-disabled={disabled || undefined}
        className={styles.Collapsible(styler.merge({className}))}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

export interface CollapsibleTriggerProps
  extends StyleProps, AriaProps, DataProps {
  /** Merge the trigger behavior onto the single child element */
  asChild?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
}

/**
 * The button that toggles the collapsible. By default it renders a fold icon
 * followed by the children as title.
 */
export function CollapsibleTrigger({
  asChild,
  onClick,
  className,
  children,
  ...props
}: CollapsibleTriggerProps) {
  const {open, disabled, contentId, toggle} =
    useCollapsible('CollapsibleTrigger')
  const attributes = {
    'data-slot': 'collapsible-trigger',
    ...props,
    'aria-expanded': open,
    'aria-controls': contentId,
    'data-state': open ? 'open' : 'closed'
  }
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event)
    if (!event.defaultPrevented) toggle()
  }
  if (asChild)
    return (
      <Slot
        {...attributes}
        className={className}
        aria-disabled={disabled || undefined}
        onClick={handleClick as SlotProps['onClick']}
      >
        {children}
      </Slot>
    )
  return (
    <button
      type="button"
      {...attributes}
      disabled={disabled}
      className={styles.CollapsibleTrigger(styler.merge({className}))}
      onClick={handleClick}
    >
      <FoldIcon expanded={open} className={styles.CollapsibleTrigger.icon()} />
      <span
        data-slot="collapsible-trigger-title"
        className={styles.CollapsibleTrigger.title()}
      >
        {children}
      </span>
    </button>
  )
}

export interface CollapsibleContentProps extends StyleProps, DataProps {
  children?: ReactNode
}

/** The content shown while the collapsible is open */
export function CollapsibleContent({
  className,
  children,
  ...props
}: CollapsibleContentProps) {
  const {open, contentId} = useCollapsible('CollapsibleContent')
  return (
    <div
      data-slot="collapsible-content"
      {...props}
      id={contentId}
      hidden={!open}
      data-state={open ? 'open' : 'closed'}
      className={styles.CollapsibleContent(styler.merge({className}))}
    >
      {open && children}
    </div>
  )
}
