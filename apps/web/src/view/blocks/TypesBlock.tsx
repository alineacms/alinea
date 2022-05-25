import {px} from '@alinea/ui'
import {Declaration} from '../types/Declaration'
import {TypeRow} from '../types/TypeRow'
import {TypesBlockSchema} from './TypesBlock.schema'

export function TypesBlock({members}: TypesBlockSchema) {
  return (
    <div style={{paddingTop: px(20)}}>
      <Declaration members={members} wrap={TypeRow} />
    </div>
  )
}
