import styler from '@alinea/styler'
import {Query} from 'alinea'
import type {Graph} from 'alinea/core/Graph'
import {DemoCollections} from '@/schema/demo'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import {
  type DemoCollectionCardData,
  type DemoTarget,
  findCollectionCards,
  targetLocale,
  targetQuery
} from '../demoData'
import {DemoCollectionCard} from '../site/DemoCollectionCard'
import {DemoContainer} from '../site/DemoContainer'
import {DemoPageIntro} from '../site/DemoPageIntro'
import css from './DemoCollectionsPage.module.scss'

const styles = styler(css)

export interface DemoCollectionsPageProps {
  locale: DemoLocale
  title: string
  intro: string
  collections: Array<DemoCollectionCardData>
}

export function DemoCollectionsPage({
  locale,
  title,
  intro,
  collections
}: DemoCollectionsPageProps) {
  return (
    <div className={styles.DemoCollectionsPage()}>
      <DemoPageIntro title={title} intro={intro} />
      <DemoContainer>
        <div className={styles.DemoCollectionsPage.grid()}>
          {collections.map(collection => (
            <DemoCollectionCard
              key={collection.id}
              locale={locale}
              collection={collection}
            />
          ))}
        </div>
      </DemoContainer>
    </div>
  )
}

DemoCollectionsPage.query = async (
  graph: Graph,
  target: DemoTarget
): Promise<DemoCollectionsPageProps> => {
  const locale = targetLocale(target)
  const page = await graph.get({
    ...targetQuery(target),
    type: DemoCollections,
    select: {
      title: DemoCollections.title,
      intro: DemoCollections.intro,
      children: Query.children({select: Query.id})
    }
  })
  const collections = await findCollectionCards(graph, page.children, locale)
  return {locale, title: page.title, intro: page.intro, collections}
}
