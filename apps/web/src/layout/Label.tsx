import styler from '@alinea/styler'
import type {HTMLAttributes} from 'react'
import css from './Label.module.scss'

const styles = styler(css)

export type LabelVariant = 'accent' | 'neutral' | 'positive'
export type LabelSize = 'medium' | 'small'

export interface LabelProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: LabelVariant
  size?: LabelSize
}

export function Label({
  variant = 'accent',
  size = 'medium',
  ...props
}: LabelProps) {
  return (
    <span
      {...props}
      className={styles.root(styler.merge(props), variant, {
        small: size === 'small'
      })}
    />
  )
}
