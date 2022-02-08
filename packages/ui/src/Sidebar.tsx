import {PropsWithChildren} from 'react'
import {Link, LinkProps} from 'react-router-dom'
import css from './Sidebar.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Sidebar {
  type ItemProps = PropsWithChildren<LinkProps & {selected?: boolean}>

  function Item({selected, ...props}: ItemProps) {
    return (
      <Link
        {...props}
        className={styles.root.menu.item.mergeProps(props)({selected})}
      />
    )
  }

  export const Root = styles.root.toElement('aside')
  export const Menu = Object.assign(styles.root.menu.toElement('nav'), {
    Item
  })
  export const List = styles.root.list.toElement('div')
}
