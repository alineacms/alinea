import {Field} from '@alinea/core'
import {createColor} from './ColorField'
import {ColorInput} from './ColorInput'
export * from './ColorField'
export * from './ColorInput'
export const color = Field.withView(createColor, ColorInput)
