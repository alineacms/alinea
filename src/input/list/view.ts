import {Field} from 'alinea/core'
import {createList} from './ListField.js'
import {ListInput} from './ListInput.js'
export * from './ListField.js'
export * from './ListInput.js'
export const list = Field.withView(createList, ListInput)
