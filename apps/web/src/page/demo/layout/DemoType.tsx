import styler from '@alinea/styler'
import {createTypo} from 'alinea/ui/util/CreateTypo'
import css from './DemoTypo.module.scss'

const styles = styler(css)

export const DemoTypo = createTypo(styles)
