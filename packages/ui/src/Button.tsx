import css from './Button.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export const Button = styles.root.toElement('button')
