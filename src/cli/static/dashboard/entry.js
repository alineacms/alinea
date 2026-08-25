import {bootProd} from 'alinea/dashboard/boot/BootProd'

const params = new URL(import.meta.url).searchParams
const handlerUrl = params.get('handlerUrl')

bootProd(handlerUrl)
