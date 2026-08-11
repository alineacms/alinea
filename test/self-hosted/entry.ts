import '#/dashboard/global.css'
import {bootProd} from '#/dashboard/boot/BootProd.js'
import {cms} from '#/dashboard/fixture/cms.js'
import {views} from '#/field/views.js'

globalThis.SharedWorker = undefined as unknown as typeof SharedWorker
bootProd('/api', cms, views)
