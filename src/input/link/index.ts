import {linkConstructors} from './LinkConstructors.js'
import {createLink} from './LinkField.js'
export * from './LinkField.js'

/** Create a link field configuration */
export const link = linkConstructors(createLink)
