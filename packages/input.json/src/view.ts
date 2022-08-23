import {Field} from '@alinea/core'
import {createJson} from './JsonField'
import {JsonInput} from './JsonInput'
export * from './JsonField'
export * from './JsonInput'
export const json = Field.withView(createJson, JsonInput)
