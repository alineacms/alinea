export * from './alinea.js'
import * as alinea from './alinea.js'

export {alinea as default}

// Next CMS constructor - deprecated
import {createNextCMS as _createNextCMS} from 'alinea/core/driver/NextDriver'
export {createNextCMS}
/** @deprecated Use import {createCMS} from 'alinea/next' instead */
const createNextCMS = _createNextCMS

export * from 'alinea/core/driver/DefaultDriver'
