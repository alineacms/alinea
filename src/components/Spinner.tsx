import styler from '@alinea/styler'
import css from './Spinner.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface SpinnerProps extends StyleProps, AriaProps, DataProps {
  size?: 'sm' | 'default' | 'lg'
  /** Progress from 0 to 100, leave out for an indeterminate spinner */
  value?: number
}

/** A circular progress indicator */
export function Spinner({
  size = 'default',
  value,
  className,
  'aria-label': ariaLabel = 'Loading',
  ...props
}: SpinnerProps) {
  const indeterminate = value === undefined
  const progress = indeterminate ? 30 : Math.min(100, Math.max(0, value))
  return (
    <span
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : progress}
      data-slot="spinner"
      data-size={size}
      data-indeterminate={indeterminate || undefined}
      {...props}
      className={styles.Spinner(styler.merge({className}))}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={styles.Spinner.icon()}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          strokeWidth={3}
          stroke="currentColor"
          strokeOpacity={0.25}
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          strokeWidth={3}
          stroke="currentColor"
          pathLength={100}
          strokeDasharray="100 200"
          strokeDashoffset={100 - progress}
          strokeLinecap="round"
          className={styles.Spinner.indicator()}
        />
      </svg>
    </span>
  )
}
