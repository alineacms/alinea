import styler from '@alinea/styler'
import {ProgressBar, type ProgressBarProps} from 'react-aria-components'

import css from './ProgressCircle.module.css'

const styles = styler(css)

interface ProgressCircleProps extends Omit<ProgressBarProps, 'className'> {
  className?: string
}

export function ProgressCircle({className, ...props}: ProgressCircleProps) {
  const c = '50%'
  const r = 'calc(50% - 2px)'
  return (
    <ProgressBar
      {...props}
      className={styles.ProgressCircle(styler.merge({className}))}
    >
      {({percentage, isIndeterminate}) => (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          data-slot="icon"
          className={styles.ProgressCircle.icon()}
        >
          <circle
            cx={c}
            cy={c}
            r={r}
            strokeWidth={3}
            stroke="currentColor"
            strokeOpacity={0.25}
          />
          {!isIndeterminate ? (
            <circle
              cx={c}
              cy={c}
              r={r}
              strokeWidth={3}
              stroke="currentColor"
              pathLength={100}
              strokeDasharray="100 200"
              strokeDashoffset={100 - (percentage ?? 0)}
              strokeLinecap="round"
              transform="rotate(-90)"
              className={styles.ProgressCircle.icon.circle()}
            />
          ) : (
            <circle
              cx={c}
              cy={c}
              r={r}
              strokeWidth={3}
              stroke="currentColor"
              pathLength={100}
              strokeDasharray="100 200"
              strokeDashoffset={100 - 30}
              strokeLinecap="round"
              className={styles.ProgressCircle.icon.circle()}
              data-indeterminate
            />
          )}
        </svg>
      )}
    </ProgressBar>
  )
}
