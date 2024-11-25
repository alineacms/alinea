import styler from '@alinea/styler'
import {PropsWithChildren} from 'react'
import css from './Badge.module.scss'
import {px} from './util/Units.js'

const styles = styler(css)

export type BadgeProps = PropsWithChildren<{
  amount?: number
  top?: number | string
  right?: number | string
  bottom?: number | string
  left?: number | string
}>

export function Badge({
  children,
  amount,
  top,
  right,
  bottom,
  left
}: BadgeProps) {
  return (
    <div className={styles.root()}>
      <div>{children}</div>
      {Number(amount) > 0 && (
        <span
          className={styles.root.number()}
          style={{
            top: top && px(top),
            right: right && px(right),
            bottom: bottom && px(bottom),
            left: left && px(left)
          }}
        >
          {amount}
        </span>
      )}
    </div>
  )
}
