import {withView} from '@alinea/core'
import {createList} from './ListField'
import {ListInput} from './ListInput'
export * from './ListField'
export const list = withView(createList, ListInput)
