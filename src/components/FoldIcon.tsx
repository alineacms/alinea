import styler from '@alinea/styler'
import type {ComponentProps} from 'react'
import {IcRoundKeyboardArrowRight} from '../dashboard/icons.js'
import {Icon} from './Icon.js'
import css from './FoldIcon.module.css'

const styles = styler(css)

export interface FoldIconProps extends Omit<
  ComponentProps<typeof Icon>,
  'icon'
> {
  expanded?: boolean
}

export function FoldIcon({expanded, className, ...props}: FoldIconProps) {
  return (
    <Icon
      {...props}
      className={styles.FoldIcon(styler.merge({className}))}
      data-expanded={expanded ? 'true' : undefined}
      icon={IcRoundKeyboardArrowRight}
    />
  )
}
