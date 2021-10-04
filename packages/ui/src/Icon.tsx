import {HTMLAttributes, ReactNode} from 'react'
import type {IconType} from 'react-icons'
import {fromModule} from '.'
import css from './Icon.module.scss'

const styles = fromModule(css)

export type IconProps = {
  icon: IconType | ReactNode
} & HTMLAttributes<HTMLSpanElement>

export function Icon({icon, ...props}: IconProps) {
  const IconView = icon as any
  return (
    <i {...props} className={styles.root.mergeProps(props)()}>
      {typeof IconView === 'function' ? <IconView /> : IconView}
    </i>
  )
}
