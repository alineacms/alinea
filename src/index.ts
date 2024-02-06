export * from './alinea.js'
import * as alinea from './alinea.js'

export {alinea as default}

export {Edit, Query} from 'alinea/core'

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
