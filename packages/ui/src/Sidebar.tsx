import css from './Sidebar.module.scss'
import {fromModule} from './styler'

const styles = fromModule(css)

const Root = styles.root.toElement('aside')
const Menu = Object.assign(styles.root.menu.toElement('nav'), {
  Item: styles.root.menu.item.toElement('div')
})
const List = styles.root.list.toElement('div')

export const Sidebar = {Root, Menu, List}
