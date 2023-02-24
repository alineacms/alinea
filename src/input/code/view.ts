import {Field} from 'alinea/core'
import {createCode} from './CodeField.js'
import {CodeInput} from './CodeInput.js'
export * from './CodeField.js'
export * from './CodeInput.js'
export const code = Field.withView(createCode, CodeInput)
