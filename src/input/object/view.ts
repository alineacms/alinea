import {Field} from 'alinea/core'
import {createObject} from './ObjectField.js'
import {ObjectInput} from './ObjectInput.js'
export * from './ObjectField.js'
export * from './ObjectInput.js'
export const object = Field.withView(createObject, ObjectInput)
