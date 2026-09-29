import styler from '@alinea/styler'
import type {Graph} from 'alinea/core/Graph'
import {DemoJournal} from '@/schema/demo'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import {
  type DemoArticleCardData,
  type DemoTarget,
  findArticleCards,
  targetLocale,
  targetQuery
} from '../demoData'
import {DemoArticleCard} from '../site/DemoArticleCard'
import {DemoContainer} from '../site/DemoContainer'
import {DemoPageIntro} from '../site/DemoPageIntro'
import css from './DemoJournalPage.module.scss'

const styles = styler(css)

export interface DemoJournalPageProps {
  locale: DemoLocale
  title: string
  intro: string
  articles: Array<DemoArticleCardData>
}

export function DemoJournalPage({
  locale,
  title,
  intro,
  articles
}: DemoJournalPageProps) {
  const [featured, ...rest] = articles
  return (
    <div className={styles.DemoJournalPage()}>
      <DemoPageIntro title={title} intro={intro} />
      <DemoContainer>
        {featured && (
          <DemoArticleCard locale={locale} article={featured} featured />
        )}
        <div className={styles.DemoJournalPage.grid()}>
          {rest.map(article => (
            <DemoArticleCard
              key={article.id}
              locale={locale}
              article={article}
            />
          ))}
        </div>
      </DemoContainer>
    </div>
  )
}

DemoJournalPage.query = async (
  graph: Graph,
  target: DemoTarget
): Promise<DemoJournalPageProps> => {
  const locale = targetLocale(target)
  const [page, articles] = await Promise.all([
    graph.get({
      ...targetQuery(target),
      type: DemoJournal,
      select: {title: DemoJournal.title, intro: DemoJournal.intro}
    }),
    findArticleCards(graph, locale)
  ])
  return {locale, title: page.title, intro: page.intro, articles}
}
