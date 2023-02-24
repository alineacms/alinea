import {ComponentType, forwardRef, HTMLAttributes, HTMLProps, Ref} from 'react'
import css from './IconButton.module.scss'
import {link} from './util/HashRouter.js'
import {fromModule} from './util/Styler.js'
import {px} from './util/Units.js'

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

export type IconLinkProps = HTMLProps<HTMLAnchorElement> & {
  icon: ComponentType
  active?: boolean
}

export const IconLink = forwardRef(function IconLink(
  {icon: Icon, active, ...props}: IconLinkProps,
  ref: Ref<HTMLAnchorElement>
) {
  return (
    <a
      ref={ref}
      {...props}
      {...link(props.href)}
      className={styles.root.mergeProps(props)({active})}
    >
      <Icon />
    </a>
  )
})
