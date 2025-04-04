import {bootProd} from 'alinea/dashboard/boot/BootProd'
// These are aliased during build
import {cms} from '#alinea/config'
import {views} from '#alinea/views'

export function boot(handlerUrl) {
  bootProd(handlerUrl, cms, views)
}
