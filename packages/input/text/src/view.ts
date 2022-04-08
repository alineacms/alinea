import {Field} from '@alineacms/core'
import {createText} from './TextField'
import {TextInput} from './TextInput'
export * from './TextField'
export * from './TextInput'
export const text = Field.withView(createText, TextInput)
