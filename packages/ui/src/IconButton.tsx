import {forwardRef, HTMLAttributes, Ref} from 'react'
import type {IconType} from 'react-icons'
import {Link, LinkProps} from 'react-router-dom'
import css from './IconButton.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export type IconButtonProps = HTMLAttributes<HTMLButtonElement> & {
  icon: IconType
  active?: boolean
}

export const IconButton = forwardRef(function IconButton(
  {icon: Icon, active, ...props}: IconButtonProps,
  ref: Ref<HTMLButtonElement>
) {
  return (
    <button
      ref={ref}
      {...props}
      className={styles.root.mergeProps(props)({active})}
    >
      <Icon />
    </button>
  )
})

export type IconLinkProps = LinkProps & {
  icon: IconType
  active?: boolean
}

export const IconLink = forwardRef(function IconLink(
  {icon: Icon, active, ...props}: IconLinkProps,
  ref: Ref<HTMLAnchorElement>
) {
  return (
    <Link
      ref={ref}
      {...props}
      className={styles.root.mergeProps(props)({active})}
    >
      <Icon />
    </Link>
  )
})
