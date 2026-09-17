import styler from '@alinea/styler'
import {createTypo} from '@/layout/util/createTypo'
import css from './DemoTypo.module.scss'

const styles = styler(css)

export const DemoTypo = createTypo(styles)
