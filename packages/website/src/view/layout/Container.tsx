import {px} from '@alinea/ui'
import {HTMLAttributes, PropsWithChildren} from 'react'

export function Container(
  props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>
) {
  return <div style={{paddingLeft: px(25), paddingRight: px(25)}} {...props} />
}
