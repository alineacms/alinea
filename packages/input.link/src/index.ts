import {linkConstructors} from './LinkConstructors'
import {createLink} from './LinkField'
export * from './LinkField'

/** Create a link field configuration */
export const link = linkConstructors(createLink)
