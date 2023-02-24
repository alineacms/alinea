import {Field} from 'alinea/core'
import {createSelect} from './SelectField.js'
import {SelectInput} from './SelectInput.js'
export * from './SelectField.js'
export * from './SelectInput.js'
export const select = Field.withView(createSelect, SelectInput)
