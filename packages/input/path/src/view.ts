import {Field} from '@alinea/core'
import {createPath} from './PathField'
import {PathInput} from './PathInput'
export * from './PathField'
export * from './PathInput'
export const path = Field.withView(createPath, PathInput)
