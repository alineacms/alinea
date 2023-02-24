import {Field} from 'alinea/core'
import {createDate} from './DateField.js'
import {DateInput} from './DateInput.js'
export * from './DateField.js'
export * from './DateInput.js'
export const date = Field.withView(createDate, DateInput)
