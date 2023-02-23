import {Field} from 'alinea/core'
import {createDate} from './DateField'
import {DateInput} from './DateInput'
export * from './DateField'
export * from './DateInput'
export const date = Field.withView(createDate, DateInput)
