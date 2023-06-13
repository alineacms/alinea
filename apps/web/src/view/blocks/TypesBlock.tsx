import {Page} from '@alinea/generated'
import {px} from 'alinea/ui'
import {Declaration} from '../types/Declaration'
import {TypeRow} from '../types/TypeRow'

export function TypesBlock({members}: Page.TypesBlock) {
  return (
    <div style={{paddingTop: px(20)}}>
      <Declaration members={members} wrap={TypeRow} />
    </div>
  )
}
