import {Card} from '@alinea/ui'
import IcOutlineArrowCircleRight from '@alinea/ui/icons/IcOutlineArrowCircleRight'
import IcRoundAddCircleOutline from '@alinea/ui/icons/IcRoundAddCircleOutline'
import IcRoundRemoveCircleOutline from '@alinea/ui/icons/IcRoundRemoveCircleOutline'
import {PropsWithChildren} from 'react'

const icons = {
  unchanged: IcOutlineArrowCircleRight,
  addition: IcRoundAddCircleOutline,
  removal: IcRoundRemoveCircleOutline
}

export type ChangeBoxProps = PropsWithChildren<{
  change: keyof typeof icons
}>

export function ChangeBox({change, children}: ChangeBoxProps) {
  const Icon = icons[change]
  return (
    <Card.Header>
      <header>
        <Icon />
      </header>
      {children}
    </Card.Header>
  )
}
