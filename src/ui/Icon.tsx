import {ComponentType, HTMLAttributes, ReactNode} from 'react'
import css from './Icon.module.scss'
import {fromModule} from './util/Styler.js'
import {px} from './util/Units.js'

const styles = fromModule(css)

export type IconProps = {
  icon: ComponentType | ReactNode
  size?: number
  active?: boolean
  round?: boolean
  variant?: 'info' | 'success' | 'disabled' | 'progress'
} & HTMLAttributes<HTMLSpanElement>

export function Icon({
  icon,
  size,
  round,
  active,
  variant,
  ...props
}: IconProps) {
  const IconView = icon as any
  if (!IconView) return null
  return (
    <i
      {...props}
      style={{...props.style, fontSize: size ? px(size) : undefined}}
      className={styles.root.mergeProps(props)({round, active}, variant)}
    >
      {typeof IconView === 'function' ? <IconView /> : IconView}
    </i>
  )
}
