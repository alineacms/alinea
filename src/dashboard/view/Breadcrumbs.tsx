import styler from '@alinea/styler'
import {HStack, Icon} from '#/ui.js'
import {IcRoundKeyboardArrowRight} from '#/ui/icons/IcRoundKeyboardArrowRight.js'
import {Fragment, type PropsWithChildren} from 'react'
import css from './Breadcrumbs.module.scss'

const styles = styler(css)

export function Breadcrumbs({children}: PropsWithChildren) {
  return (
    <HStack center gap={8} className={styles.root()}>
      {children}
    </HStack>
  )
}

export function BreadcrumbsItem({children}: PropsWithChildren) {
  return (
    <Fragment>
      {children}
      <span className={styles.root.separator()}>
        <Icon icon={IcRoundKeyboardArrowRight} size={17} />
      </span>
    </Fragment>
  )
}
