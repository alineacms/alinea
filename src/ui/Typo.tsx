import css from './Typo.module.scss'
import {createTypo} from './util/CreateTypo.js'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export const Typo = createTypo(styles)
