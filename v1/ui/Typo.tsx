import styler from '@alinea/styler'
import css from './Typo.module.scss'
import {createTypo} from './util/CreateTypo.js'

const styles = styler(css)

export const Typo = createTypo(styles)
