import {withView} from '@alinea/core'
import {createPath} from './PathField'
import {PathInput} from './PathInput'
export * from './PathField'
export const path = withView(createPath, PathInput)
