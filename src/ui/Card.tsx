import css from './Card.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export namespace Card {
  export const Root = styles.root.toElement('div')
  export const Row = styles.row.toElement('div')
  export const Content = styles.content.toElement('div')
  export const Options = styles.options.toElement('div')
  export const Header = styles.header.toElement('header')
  export const Title = styles.title.toElement('p')
}
