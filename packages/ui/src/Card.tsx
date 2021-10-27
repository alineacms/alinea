import css from './Card.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Card {
  export const Root = styles.root.toElement('div')
  export const Content = styles.content.toElement('div')
  export const Options = styles.options.toElement('div')
}
