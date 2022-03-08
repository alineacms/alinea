import {px} from '@alinea/ui'
import {HTMLAttributes, PropsWithChildren} from 'react'

export function Container(
  props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>
) {
  return (
    <div
      style={{
        paddingLeft: px(25),
        paddingRight: px(25),
        maxWidth: px(960),
        width: '100%',
        margin: '0 auto'
      }}
      {...props}
    />
  )
}
