import {bootProd} from 'alinea/dashboard/boot/BootProd'
// These are aliased during build
import {cms} from '#alinea/config'
import {views} from '#alinea/views'

bootProd(process.env.ALINEA_HANDLER_URL, cms, views)
