import {forwardRef, HTMLAttributes, Ref} from 'react'
import type {IconType} from 'react-icons'
import css from './IconButton.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export type IconButtonProps = HTMLAttributes<HTMLButtonElement> & {
  icon: IconType
}

export const IconButton = forwardRef(function IconButton(
  {icon: Icon, ...props}: IconButtonProps,
  ref: Ref<HTMLButtonElement>
) {
  return (
    <button ref={ref} className={styles.root()} {...props}>
      <Icon />
    </button>
  )
})
