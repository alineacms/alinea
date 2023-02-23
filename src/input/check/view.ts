import {Field} from 'alinea/core'
import {createCheck} from './CheckField'
import {CheckInput} from './CheckInput'
export * from './CheckField'
export * from './CheckInput'
export const check = Field.withView(createCheck, CheckInput)
