import {Field} from 'alinea/core'
import {createNumber} from './NumberField.js'
import {NumberInput} from './NumberInput.js'
export * from './NumberField.js'
export * from './NumberInput.js'
export const number = Field.withView(createNumber, NumberInput)
