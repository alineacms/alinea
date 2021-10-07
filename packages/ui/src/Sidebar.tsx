import {HTMLAttributes, PropsWithChildren} from 'react'
import css from './Sidebar.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Sidebar {
  type ItemProps = PropsWithChildren<
    HTMLAttributes<HTMLAnchorElement> & {selected?: boolean}
  >

  function Item({selected, ...props}: ItemProps) {
    return (
      <a
        {...props}
        className={styles.root.menu.item.is({selected}).mergeProps(props)()}
      />
    )
  }

  export const Root = styles.root.toElement('aside')
  export const Menu = Object.assign(styles.root.menu.toElement('nav'), {
    Item
  })
  export const List = styles.root.list.toElement('div')
}
