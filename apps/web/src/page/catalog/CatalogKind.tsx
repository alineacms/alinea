import styler from '@alinea/styler'
import Link from 'next/link'
import type {ComponentType, SVGProps} from 'react'
import {StrokeBlocks, StrokeDatabase} from '@/icons'
import {DocsIconArrowRight} from '@/page/docs/DocsIcons'
import css from './CatalogKind.module.scss'

const styles = styler(css)

type CatalogKindId = 'fields' | 'components'

interface KindInfo {
  id: CatalogKindId
  title: string
  code: string
  text: string
  href: string
  link: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const kinds: Array<KindInfo> = [
  {
    id: 'fields',
    title: 'Fields',
    code: "Field.text('Title')",
    text: 'Model your content in cms.tsx. Each field stores a value and gives editors the input to change it.',
    href: '/docs/fields',
    link: 'Browse fields',
    icon: StrokeDatabase
  },
  {
    id: 'components',
    title: 'Components',
    code: '<Button>',
    text: 'Build your own React views for the dashboard, with the same look and behavior as the rest of it.',
    href: '/docs/components',
    link: 'Browse components',
    icon: StrokeBlocks
  }
]

export interface CatalogKindProps {
  active: CatalogKindId
}

/**
 * Explains the difference between schema fields and dashboard components,
 * which look alike in their catalogs, and links to the other one
 */
export function CatalogKind({active}: CatalogKindProps) {
  return (
    <nav aria-label="Fields or components" className={styles.root()}>
      {kinds.map(kind => {
        const current = kind.id === active
        const Icon = kind.icon
        const content = (
          <>
            <span className={styles.root.icon()}>
              <Icon />
            </span>
            <span className={styles.root.body()}>
              <span className={styles.root.title()}>
                {kind.title}
                <code className={styles.root.code()}>{kind.code}</code>
              </span>
              <span className={styles.root.text()}>{kind.text}</span>
              <span className={styles.root.link()}>
                {current ? (
                  'You are here'
                ) : (
                  <>
                    {kind.link}
                    <DocsIconArrowRight className={styles.root.link.icon()} />
                  </>
                )}
              </span>
            </span>
          </>
        )
        if (current)
          return (
            <div
              key={kind.id}
              aria-current="page"
              className={styles.root.card({current})}
            >
              {content}
            </div>
          )
        return (
          <Link key={kind.id} href={kind.href} className={styles.root.card()}>
            {content}
          </Link>
        )
      })}
    </nav>
  )
}
