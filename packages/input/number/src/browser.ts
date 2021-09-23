import {withView} from '@alinea/core'
import {createNumber} from './NumberField'
import {NumberInput} from './NumberInput'
export * from './NumberField'
export const number = withView(createNumber, NumberInput)
