import {Field} from 'alinea/core'
import {createPath} from './PathField.js'
import {PathInput} from './PathInput.js'
export * from './PathField.js'
export * from './PathInput.js'
export const path = Field.withView(createPath, PathInput)
