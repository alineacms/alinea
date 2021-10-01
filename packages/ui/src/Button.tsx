import css from './Button.module.scss'
import {fromModule} from './util/styler'

const styles = fromModule(css)

export const Button = styles.root.toElement('button')
