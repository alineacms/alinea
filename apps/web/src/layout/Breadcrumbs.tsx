import {fromModule, HStack} from 'alinea/ui'
import Link from 'next/link'
import {Fragment} from 'react'
import css from './Breadcrumbs.module.scss'

const styles = fromModule(css)

type Parent = {
  id: string
  title: string
  url?: string
}

export type BreadcrumbsProps = {
  parents: Array<Parent>
  flat?: boolean
}

export function Breadcrumbs({parents, flat}: BreadcrumbsProps) {
  return (
    <HStack gap={8} className={styles.root({flat})}>
      {parents.map((parent, i) => {
        const link = parent.url ? (
          <Link href={parent.url}>{parent.title}</Link>
        ) : (
          <span>{parent.title}</span>
        )
        return (
          <Fragment key={parent.id}>
            {link}
            {i !== parents.length - 1 && (
              <span className={styles.root.separator()}>/</span>
            )}
          </Fragment>
        )
      })}
    </HStack>
  )
}
