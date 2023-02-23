import {Field} from 'alinea/core'
import {createObject} from './ObjectField'
import {ObjectInput} from './ObjectInput'
export * from './ObjectField'
export * from './ObjectInput'
export const object = Field.withView(createObject, ObjectInput)
