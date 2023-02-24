import {Field} from 'alinea/core'
import {linkConstructors} from './LinkConstructors.js'
import {createLink} from './LinkField.js'
import {LinkInput} from './LinkInput.js'
export * from './LinkField.js'
export * from './LinkInput.js'

const createLinkInput = Field.withView(createLink, LinkInput)

/** Create a link field configuration */
export const link = linkConstructors(createLinkInput)
