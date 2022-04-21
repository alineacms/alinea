import {Declaration} from '../types/Declaration'
import {TypeRow} from '../types/TypeRow'
import {TypesBlockProps} from './TypesBlock.query'

export function TypesBlock({members}: TypesBlockProps) {
  return (
    <div>
      <Declaration members={members} wrap={TypeRow} />
    </div>
  )
}
