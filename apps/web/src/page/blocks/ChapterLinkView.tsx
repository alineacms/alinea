import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Link} from '@/layout/nav/Link'
import {DocsIconArrowRight} from '@/page/docs/DocsIcons'
import type {ChapterLinkBlock} from '@/schema/blocks/ChapterLinkBlock'
import css from './ChapterLinkView.module.scss'

const styles = styler(css)

export function ChapterLinkView({link}: Infer<typeof ChapterLinkBlock>) {
  if (!link || !link.href) return null
  return (
    <Link href={link.href} className={styles.root()}>
      <span className={styles.root.title()}>
        {(link.fields.description || link.title) as string}
      </span>
      <DocsIconArrowRight className={styles.root.icon()} />
    </Link>
  )
}
