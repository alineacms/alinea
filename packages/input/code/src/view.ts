import {Field} from '@alineacms/core'
import {createCode} from './CodeField'
import {CodeInput} from './CodeInput'
export * from './CodeField'
export * from './CodeInput'
export const code = Field.withView(createCode, CodeInput)
