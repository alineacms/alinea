import {withView} from '@alinea/core'
import {createText} from './TextField'
import {TextInput} from './TextInput'
export * from './TextField'
export * from './TextInput'
export const text = withView(createText, TextInput)
