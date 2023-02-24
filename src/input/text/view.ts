import {Field} from 'alinea/core'
import {createText} from './TextField.js'
import {TextInput} from './TextInput.js'
export * from './TextField.js'
export * from './TextInput.js'
export const text = Field.withView(createText, TextInput)
