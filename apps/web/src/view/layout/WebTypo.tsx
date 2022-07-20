import {createTypo} from '@alinea/ui/util/CreateTypo'
import {fromModule} from '@alinea/ui/util/Styler'
import css from './WebTypo.module.scss'

const styles = fromModule(css)

export const WebTypo = createTypo(styles)
