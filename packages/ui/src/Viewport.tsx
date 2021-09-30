import {fromModule} from './util/styler'
import css from './Viewport.module.scss'

const styles = fromModule(css)

export const Viewport = styles.root.toElement('main')
