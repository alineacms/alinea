import styler from '@alinea/styler'
import {
  createContext,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef
} from 'react'
import {IcRoundArrowBack, IcRoundClose} from '#/dashboard/icons.js'
import {Button} from './Button.js'
import css from './Sheet.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

const fields =
  'input:not([type="hidden"]), textarea, select, [contenteditable="true"]'
const focusables =
  'button, [href], input, textarea, select, [contenteditable="true"], [tabindex]'

interface SheetContextValue {
  titleId: string
  backLabel: string
  onClose?: () => void
}

const SheetContext = createContext<SheetContextValue | null>(null)

function focusable(element: HTMLElement): boolean {
  return (
    element.tabIndex >= 0 &&
    !element.matches(':disabled') &&
    !element.closest('[aria-hidden="true"], [inert]')
  )
}

function first(root: Element, selector: string): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).find(
    focusable
  )
}

export interface SheetContentProps extends StyleProps, AriaProps, DataProps {
  /** Called on Escape while focus is inside the sheet, and by `SheetClose` */
  onClose?: () => void
  /** Accessible label of the back button in the header, defaults to "Back" */
  backLabel?: string
  children: ReactNode
}

/**
 * A non-modal panel that fills its positioned container. Mount it to open
 * the sheet: focus moves to its first field, and returns to the previously
 * focused element when it unmounts. Labelled by its `SheetTitle` unless
 * given an `aria-label`.
 */
export function SheetContent({
  onClose,
  backLabel = 'Back',
  className,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}: SheetContentProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const context = useMemo(
    () => ({titleId, backLabel, onClose}),
    [titleId, backLabel, onClose]
  )
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const previous = document.activeElement
    const body = root.querySelector('[data-slot="sheet-body"]') ?? root
    const target = first(body, fields) ?? first(body, focusables) ?? root
    target.focus()
    return () => {
      const active = document.activeElement
      const lost = !active || active === document.body || root.contains(active)
      // Leave focus alone when the user already moved on, eg. to another row
      if (lost && previous instanceof HTMLElement && previous.isConnected)
        previous.focus()
    }
  }, [])
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' || event.defaultPrevented || !onClose) return
    event.preventDefault()
    onClose()
  }
  return (
    <SheetContext.Provider value={context}>
      <div
        data-slot="sheet-content"
        role="dialog"
        tabIndex={-1}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby ?? (ariaLabel ? undefined : titleId)}
        {...props}
        ref={ref}
        className={styles.SheetContent(styler.merge({className}))}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </SheetContext.Provider>
  )
}

export interface SheetPartProps extends StyleProps, AriaProps, DataProps {
  children?: ReactNode
}

export interface SheetHeaderProps extends SheetPartProps {}

/**
 * Top bar of the sheet, eg. a badge, the title, a key hint and SheetClose.
 * Starts with a back button when the sheet has an `onClose`.
 */
export function SheetHeader({className, children, ...props}: SheetHeaderProps) {
  const context = useContext(SheetContext)
  return (
    <div
      data-slot="sheet-header"
      {...props}
      className={styles.SheetHeader(styler.merge({className}))}
    >
      {context?.onClose && (
        <Button
          data-slot="sheet-back"
          variant="ghost"
          size="icon"
          icon={IcRoundArrowBack}
          aria-label={context.backLabel}
          className={styles.SheetHeader.back()}
          onClick={context.onClose}
        />
      )}
      {children}
    </div>
  )
}

export interface SheetTitleProps extends SheetPartProps {}

export function SheetTitle({className, ...props}: SheetTitleProps) {
  const context = useContext(SheetContext)
  return (
    <h2
      data-slot="sheet-title"
      id={context?.titleId}
      {...props}
      className={styles.SheetTitle(styler.merge({className}))}
    />
  )
}

export interface SheetBodyProps extends SheetPartProps {}

/** Scrolling content of the sheet, holds SheetSection elements */
export function SheetBody({className, ...props}: SheetBodyProps) {
  return (
    <div
      data-slot="sheet-body"
      {...props}
      className={styles.SheetBody(styler.merge({className}))}
    />
  )
}

export interface SheetSectionProps extends SheetPartProps {
  title?: ReactNode
}

export function SheetSection({
  title,
  className,
  children,
  ...props
}: SheetSectionProps) {
  return (
    <section
      data-slot="sheet-section"
      {...props}
      className={styles.SheetSection(styler.merge({className}))}
    >
      {title && (
        <h3
          data-slot="sheet-section-title"
          className={styles.SheetSection.title()}
        >
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}

export interface SheetFooterProps extends SheetPartProps {}

/**
 * Bottom bar of the sheet, holds small ghost buttons. Destructive buttons
 * are pushed to the end.
 */
export function SheetFooter({className, ...props}: SheetFooterProps) {
  return (
    <div
      data-slot="sheet-footer"
      {...props}
      className={styles.SheetFooter(styler.merge({className}))}
    />
  )
}

export interface SheetCloseProps extends StyleProps, DataProps {
  'aria-label': string
  /** Defaults to the `onClose` of the surrounding SheetContent */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}

export function SheetClose({onClick, ...props}: SheetCloseProps) {
  const context = useContext(SheetContext)
  return (
    <Button
      data-slot="sheet-close"
      {...props}
      variant="ghost"
      size="icon"
      icon={IcRoundClose}
      onClick={onClick ?? (() => context?.onClose?.())}
    />
  )
}
