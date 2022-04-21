import {px, Typo} from '@alinea/ui'
import {Declaration} from '../types/Declaration'
import {TypeRow} from '../types/TypeRow'
import {TypesBlockProps} from './TypesBlock.query'

export function TypesBlock({members}: TypesBlockProps) {
  return (
    <div style={{paddingTop: px(20)}}>
      <Typo.H3 flat>Types</Typo.H3>
      <Declaration members={members} wrap={TypeRow} />
    </div>
  )
}
