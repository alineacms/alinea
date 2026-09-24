import styler from '@alinea/styler'
import Link from 'next/link'
import type {ReactNode} from 'react'
import {Label} from '@/layout/Label'
import css from './CatalogCard.module.scss'

const styles = styler(css)

export interface CatalogCardProps {
  href: string
  /** Fields show their input on a form, components on a canvas */
  kind: 'field' | 'component'
  name: string
  /** How to use it in code, eg. `Field.text` or `<Button>` */
  code: string
  meta?: string
  badge?: string
  preview: ReactNode
}

export function CatalogCard({
  href,
  kind,
  name,
  code,
  meta,
  badge,
  preview
}: CatalogCardProps) {
  return (
    // The title link covers the card, previews may contain links themselves
    <div className={styles.root(kind)}>
      <div className={styles.root.stage()}>{preview}</div>
      <div className={styles.root.body()}>
        <div className={styles.root.row()}>
          <Link href={href} className={styles.root.title()}>
            {name}
          </Link>
          {badge && <Label size="small">{badge}</Label>}
        </div>
        <div className={styles.root.row()}>
          <code className={styles.root.code()}>{code}</code>
          {meta && <span className={styles.root.meta()}>{meta}</span>}
        </div>
      </div>
    </div>
  )
}
