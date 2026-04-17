import styler from '@alinea/styler'
import {HStack, Icon} from '#/ui.js'
import {IcOutlineArrowCircleRight} from '#/ui/icons/IcOutlineArrowCircleRight.js'
import {IcRoundAddCircleOutline} from '#/ui/icons/IcRoundAddCircleOutline.js'
import {IcRoundMoreHoriz} from '#/ui/icons/IcRoundMoreHoriz.js'
import {IcRoundRemoveCircleOutline} from '#/ui/icons/IcRoundRemoveCircleOutline.js'
import type {PropsWithChildren} from 'react'
import css from './ChangeBox.module.scss'

const styles = styler(css)

const icons = {
  keep: IcOutlineArrowCircleRight,
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
