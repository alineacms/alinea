import {content} from '@alinea/content/web'
import {Store} from '@alinea/store'
import {typeInfo} from '../../data/Types'
import {TypesBlockSchema} from './TypesBlock.schema'

export async function typesBlockQuery(
  pages: content.Pages,
  block: TypesBlockSchema
) {
  const types = String(block.types)
    .split(',')
    .map(type => type.trim())
  return {
    ...block,
    members: typeInfo(types)
  }
}

export type TypesBlockProps = Store.TypeOf<ReturnType<typeof typesBlockQuery>>
