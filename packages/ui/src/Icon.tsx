import {ComponentType, HTMLAttributes, ReactNode} from 'react'
import css from './Icon.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export type IconProps = {
  icon: ComponentType | ReactNode
} & HTMLAttributes<HTMLSpanElement>

export function Icon({icon, ...props}: IconProps) {
  const IconView = icon as any
  if (!IconView) return null
  return (
    <i {...props} className={styles.root.mergeProps(props)()}>
      {typeof IconView === 'function' ? <IconView /> : IconView}
    </i>
  )
}
