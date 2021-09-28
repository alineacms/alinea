import {HTMLAttributes} from 'react'
import type {IconType} from 'react-icons'
import css from './IconButton.module.scss'
import {fromModule} from './util/styler'

const styles = fromModule(css)

export type IconButtonProps = HTMLAttributes<HTMLButtonElement> & {
  icon: IconType
}

export function IconButton({icon: Icon}: IconButtonProps) {
  return (
    <button className={styles.root()}>
      <Icon />
    </button>
  )
}
