import {Field} from '@alinea/core'
import {linkConstructors} from './LinkConstructors'
import {createLink} from './LinkField'
import {LinkInput} from './LinkInput'
export * from './LinkField'
export * from './LinkInput'

const createLinkInput = Field.withView(createLink, LinkInput)

/** Create a link field configuration */
export const link = linkConstructors(createLinkInput)
