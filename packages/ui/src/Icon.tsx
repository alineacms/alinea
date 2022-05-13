import {ComponentType, HTMLAttributes, ReactNode} from 'react'
import css from './Icon.module.scss'
import {fromModule} from './util/Styler'
import {px} from './util/Units'

const styles = fromModule(css)

export type IconProps = {
  icon: ComponentType | ReactNode
  size?: number
  active?: boolean
} & HTMLAttributes<HTMLSpanElement>

export function Icon({icon, size, active, ...props}: IconProps) {
  const IconView = icon as any
  if (!IconView) return null
  return (
    <i
      {...props}
      style={{...props.style, fontSize: size ? px(size) : undefined}}
      className={styles.root.mergeProps(props)({active})}
    >
      {typeof IconView === 'function' ? <IconView /> : IconView}
    </i>
  )
}
