import {Field} from '@alineacms/core'
import {createNumber} from './NumberField'
import {NumberInput} from './NumberInput'
export * from './NumberField'
export * from './NumberInput'
export const number = Field.withView(createNumber, NumberInput)
