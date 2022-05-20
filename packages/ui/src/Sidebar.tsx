import {PropsWithChildren} from 'react'
import {Link, LinkProps} from 'react-router-dom'
import {Badge} from './Badge'
import css from './Sidebar.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Sidebar {
  type ItemProps = PropsWithChildren<
    LinkProps & {selected?: boolean; badge?: number}
  >

  function Item({children, selected, badge, ...props}: ItemProps) {
    return (
      <Link
        {...props}
        className={styles.root.menu.item.mergeProps(props)({selected})}
      >
        <Badge amount={badge} right={-4} bottom={-3}>
          {children}
        </Badge>
      </Link>
    )
  }

  export const Root = styles.root.toElement('aside')
  export const Menu = Object.assign(styles.root.menu.toElement('nav'), {
    Item
  })
}
