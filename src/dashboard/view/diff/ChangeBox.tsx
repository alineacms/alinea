import {fromModule, HStack, Icon} from 'alinea/ui'
import {IcOutlineArrowCircleRight} from 'alinea/ui/icons/IcOutlineArrowCircleRight'
import {IcRoundAddCircleOutline} from 'alinea/ui/icons/IcRoundAddCircleOutline'
import {IcRoundMoreHoriz} from 'alinea/ui/icons/IcRoundMoreHoriz'
import {IcRoundRemoveCircleOutline} from 'alinea/ui/icons/IcRoundRemoveCircleOutline'
import {PropsWithChildren} from 'react'
import css from './ChangeBox.module.scss'

const styles = fromModule(css)

const icons = {
  unchanged: IcOutlineArrowCircleRight,
  addition: IcRoundAddCircleOutline,
  removal: IcRoundRemoveCircleOutline
}

export type ChangeBoxProps = PropsWithChildren<{
  change: keyof typeof icons | 'equal'
}>

export function ChangeBox({change, children}: ChangeBoxProps) {
  return (
    <HStack gap={8} className={styles.root(change)}>
      {change !== 'equal' ? (
        <div className={styles.root.content()}>{children}</div>
      ) : (
        <HStack center justify="center" full>
          <Icon icon={IcRoundMoreHoriz} />
        </HStack>
      )}
    </HStack>
  )
}
