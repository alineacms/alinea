import css from './Typo.module.scss'
import {createTypo} from './util/CreateTypo'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export const Typo = createTypo(styles)
