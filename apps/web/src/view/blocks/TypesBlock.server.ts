import {Pages} from 'alinea/backend'
import {Expr} from 'alinea/store'
import {typeInfo} from '../../data/Types'

export function transformTypes(
  block: Expr<{types: string}>,
  pages: Pages<any>
) {
  return pages.process(block, block => {
    const types = String(block.types)
      .split(',')
      .map(type => type.trim())
    return {
      ...block,
      members: typeInfo(types)
    }
  })
}
