import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {DemoJournalTeaserBlock} from '@/schema/demo/DemoBlocks'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import type {DemoArticleCardData} from '../demoData'
import {DemoArticleCard} from './DemoArticleCard'
import {DemoContainer} from './DemoContainer'
import {DemoSectionHeader} from './DemoSectionHeader'
import css from './DemoJournalTeaser.module.scss'
import {demoLink} from './demoLink'

const styles = styler(css)

export interface DemoJournalTeaserProps extends Infer<
  typeof DemoJournalTeaserBlock
> {
  locale: DemoLocale
  articles: Array<DemoArticleCardData>
}

export function DemoJournalTeaser({
  title,
  count,
  link,
  locale,
  articles
}: DemoJournalTeaserProps) {
  const shown = articles.slice(0, count || 3)
  if (shown.length === 0) return null
  return (
    <section className={styles.DemoJournalTeaser()}>
      <DemoContainer>
        <DemoSectionHeader title={title} link={demoLink(link)} />
        <div className={styles.DemoJournalTeaser.grid()}>
          {shown.map(article => (
            <DemoArticleCard
              key={article.id}
              locale={locale}
              article={article}
            />
          ))}
        </div>
      </DemoContainer>
    </section>
  )
}
