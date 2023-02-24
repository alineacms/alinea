import {Page} from 'alinea/content'
import {px} from 'alinea/ui'
import {Declaration} from '../types/Declaration.js'
import {TypeRow} from '../types/TypeRow.js'

export function TypesBlock({members}: Page.TypesBlock) {
  return (
    <div style={{paddingTop: px(20)}}>
      <Declaration members={members} wrap={TypeRow} />
    </div>
  )
}
