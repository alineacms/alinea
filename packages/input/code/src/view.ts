import {withView} from '@alinea/core'
import {createCode} from './CodeField'
import {CodeInput} from './CodeInput'
export * from './CodeField'
export * from './CodeInput'
export const code = withView(createCode, CodeInput)
