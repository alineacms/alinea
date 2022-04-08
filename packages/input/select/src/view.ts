import {Field} from '@alineacms/core'
import {createSelect} from './SelectField'
import {SelectInput} from './SelectInput'
export * from './SelectField'
export * from './SelectInput'
export const select = Field.withView(createSelect, SelectInput)
