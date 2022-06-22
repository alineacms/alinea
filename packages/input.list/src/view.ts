import {Field} from '@alinea/core'
import {createList} from './ListField'
import {ListInput} from './ListInput'
export * from './ListField'
export * from './ListInput'
export const list = Field.withView(createList, ListInput)
