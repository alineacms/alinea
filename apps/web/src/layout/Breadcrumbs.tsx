import {Label} from 'alinea/core'
import {fromModule, HStack, TextLabel} from 'alinea/ui'
import {Fragment} from 'react'
import css from './Breadcrumbs.module.scss'

const styles = fromModule(css)

type Parent = {
  id: string
  title: Label
  url: string
}

export type BreadcrumbsProps = {
  parents: Array<Parent>
}

export function Breadcrumbs({parents}: BreadcrumbsProps) {
  return (
    <HStack gap={16} className={styles.root()}>
      {parents.map((parent, i) => {
        return (
          <Fragment key={parent.id}>
            <span>
              <TextLabel label={parent.title} />
            </span>
            {i !== parents.length - 1 && (
              <span className={styles.root.separator()}>/</span>
            )}
          </Fragment>
        )
      })}
    </HStack>
  )
}
