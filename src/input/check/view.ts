import {Field} from 'alinea/core'
import {createCheck} from './CheckField.js'
import {CheckInput} from './CheckInput.js'
export * from './CheckField.js'
export * from './CheckInput.js'
export const check = Field.withView(createCheck, CheckInput)
