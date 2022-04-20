import {Store} from '@alinea/store'
import {Pages} from '../../../.alinea/web'
import {TypesBlockSchema} from './TypesBlock.schema'

export async function typesBlockQuery(pages: Pages, block: TypesBlockSchema) {
  return {
    ...block
  }
}

export type TypesBlockProps = Store.TypeOf<ReturnType<typeof typesBlockQuery>>
