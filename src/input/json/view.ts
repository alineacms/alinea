import {Field} from 'alinea/core'
import {createJson} from './JsonField.js'
import {JsonInput} from './JsonInput.js'
export * from './JsonField.js'
export * from './JsonInput.js'
export const json = Field.withView(createJson, JsonInput)
