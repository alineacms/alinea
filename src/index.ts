import * as alinea from './alinea.js'
export {alinea as default}

export * as Config from './config.js'
export {Edit} from './core/Edit.js'
export {Query} from './core/Query.js'
export * as Field from './field.js'
export * from './types.js'

// Next CMS constructor - deprecated
import {createNextCMS as _createNextCMS} from 'alinea/core/driver/NextDriver'
export {createNextCMS}
/** @deprecated Use import {createCMS} from 'alinea/next' instead */
const createNextCMS = _createNextCMS

// Default CMS constructor - deprecated
import {createCMS as _createCMS} from 'alinea/core/driver/DefaultDriver'
export {createCMS}
/** @deprecated Use import {createCMS} from 'alinea/core' instead */
const createCMS = _createCMS
