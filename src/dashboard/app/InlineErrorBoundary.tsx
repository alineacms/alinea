import {Icon} from '#/components.js'
import {styler} from '@alinea/styler'
import type {PropsWithChildren, ReactNode} from 'react'
import useErrorBoundary from 'use-error-boundary'
import {IcBaselineErrorOutline} from '../icons.js'
import {DashboardModalDialog} from './ui/DashboardModal.js'
import css from './InlineErrorBoundary.module.css'

const styles = styler(css)

export interface InlineErrorBoundaryProps extends PropsWithChildren {
  title: string
  /** Places the error, for example in the popover that failed to open */
  wrap?: (error: ReactNode) => ReactNode
}

/** Keeps a failing field or picker from taking down the whole dashboard */
export function InlineErrorBoundary({
  title,
  wrap = error => error,
  children
}: InlineErrorBoundaryProps) {
  const {ErrorBoundary, didCatch, error} = useErrorBoundary()
  if (didCatch) return wrap(<InlineError title={title} error={error} />)
  return <ErrorBoundary>{children}</ErrorBoundary>
}

export interface InlineErrorProps {
  title: string
  error: unknown
}

export function InlineError({title, error}: InlineErrorProps) {
  return (
    <div role="alert" className={styles.InlineError()}>
      <Icon
        icon={IcBaselineErrorOutline}
        className={styles.InlineError.icon()}
      />
      <div className={styles.InlineError.text()}>
        <span className={styles.InlineError.title()}>{title}</span>
        <span className={styles.InlineError.message()}>
          {error instanceof Error ? error.message : String(error)}
        </span>
      </div>
    </div>
  )
}

/** Shows a picker that failed to open as a dialog holding the error */
export function PickerErrorBoundary({children}: PropsWithChildren) {
  return (
    <InlineErrorBoundary
      title="Could not open the picker"
      wrap={error => (
        <DashboardModalDialog label="Pick an entry">
          <div className={styles.PickerError()}>{error}</div>
        </DashboardModalDialog>
      )}
    >
      {children}
    </InlineErrorBoundary>
  )
}
