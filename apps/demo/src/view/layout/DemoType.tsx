import {fromModule} from 'alinea/ui'
import {createTypo} from 'alinea/ui/util/CreateTypo'
import css from './DemoTypo.module.scss'

const styles = fromModule(css)

export const DemoTypo = createTypo(styles)
