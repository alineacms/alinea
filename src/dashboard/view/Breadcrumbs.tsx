import {fromModule, HStack, Icon} from 'alinea/ui'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {Fragment, ReactNode} from 'react'
import {link} from '../atoms/LocationAtoms.js'
import css from './Breadcrumbs.module.scss'

const styles = fromModule(css)

interface Parent {
  id: string
  title: ReactNode
  url?: string
}

export type BreadcrumbsProps = {
  parents: Array<Parent>
}

export function Breadcrumbs({parents}: BreadcrumbsProps) {
  return (
    <HStack center gap={8} className={styles.root()}>
      {parents.map((parent, i) => {
        const inner = parent.url ? (
          <a {...link(parent.url)}>{parent.title}</a>
        ) : (
          <span>{parent.title}</span>
        )
        return (
          <Fragment key={parent.id}>
            {inner}
            {i !== parents.length - 1 && (
              <span className={styles.root.separator()}>
                <Icon icon={IcRoundKeyboardArrowRight} size={17} />
              </span>
            )}
          </Fragment>
        )
      })}
    </HStack>
  )
}
