import {bootProd} from 'alinea/dashboard/boot/BootProd'
// These are aliased during build
import {cms} from '#alinea/config'
import {views} from '#alinea/views'

const params = new URL(import.meta.url).searchParams
const handlerUrl = params.get('handlerUrl')

bootProd(handlerUrl, cms, views)
