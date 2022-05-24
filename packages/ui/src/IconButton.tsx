import {ComponentType, forwardRef, HTMLAttributes, Ref} from 'react'
import {Link, LinkProps} from 'react-router-dom'
import css from './IconButton.module.scss'
import {fromModule} from './util/Styler'
import {px} from './util/Units'

const styles = fromModule(css)

export type IconButtonProps = HTMLAttributes<HTMLButtonElement> & {
  icon: ComponentType
  size?: number
  active?: boolean
  disabled?: boolean
}

export const IconButton = forwardRef(function IconButton(
  {icon: Icon, active, size, ...props}: IconButtonProps,
  ref: Ref<HTMLButtonElement>
) {
  return (
    <button
      type="button"
      ref={ref}
      {...props}
      style={{...props.style, fontSize: size ? px(size) : undefined}}
      className={styles.root.mergeProps(props)({active})}
    >
      <Icon />
    </button>
  )
})

export type IconLinkProps = LinkProps & {
  icon: ComponentType
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
