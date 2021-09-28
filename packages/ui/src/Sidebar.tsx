import css from './Sidebar.module.scss'
import {fromModule} from './util/styler'

const styles = fromModule(css)

export namespace Sidebar {
  export const Root = styles.root.toElement('aside')
  export const Menu = Object.assign(styles.root.menu.toElement('nav'), {
    Item: styles.root.menu.item.toElement('div')
  })
  export const List = styles.root.list.toElement('div')
}
