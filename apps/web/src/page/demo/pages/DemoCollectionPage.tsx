import styler from '@alinea/styler'
import type {Graph} from 'alinea/core/Graph'
import type {ImageLink} from 'alinea'
import {DemoCollection} from '@/schema/demo'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import {
  type DemoProductCardData,
  type DemoTarget,
  findProductCards,
  targetLocale,
  targetQuery
} from '../demoData'
import {demoStrings} from '../demoStrings'
import {DemoContainer} from '../site/DemoContainer'
import {DemoImage} from '../site/DemoImage'
import {DemoProductGrid} from '../site/DemoProductGrid'
import css from './DemoCollectionPage.module.scss'

const styles = styler(css)

export interface DemoCollectionPageProps {
  locale: DemoLocale
  title: string
  intro: string
  cover: ImageLink | null
  products: Array<DemoProductCardData>
}

export function DemoCollectionPage({
  locale,
  title,
  intro,
  cover,
  products
}: DemoCollectionPageProps) {
  const t = demoStrings(locale)
  return (
    <div className={styles.DemoCollectionPage()}>
      <DemoContainer>
        <header className={styles.DemoCollectionPage.header()}>
          <div className={styles.DemoCollectionPage.content()}>
            <p className={styles.DemoCollectionPage.count()}>
              {t.products(products.length)}
            </p>
            <h1 className={styles.DemoCollectionPage.title()}>{title}</h1>
            {intro && (
              <p className={styles.DemoCollectionPage.intro()}>{intro}</p>
            )}
          </div>
          <DemoImage
            image={cover}
            ratio="5 / 4"
            eager
            className={styles.DemoCollectionPage.cover()}
          />
        </header>
        <DemoProductGrid locale={locale} products={products} />
      </DemoContainer>
    </div>
  )
}

DemoCollectionPage.query = async (
  graph: Graph,
  target: DemoTarget
): Promise<DemoCollectionPageProps> => {
  const locale = targetLocale(target)
  const collection = await graph.get({
    ...targetQuery(target),
    type: DemoCollection,
    select: {
      title: DemoCollection.title,
      intro: DemoCollection.intro,
      cover: DemoCollection.cover,
      products: DemoCollection.products
    }
  })
  const products = await findProductCards(
    graph,
    (collection.products ?? []).map(link => link.entryId),
    locale
  )
  return {
    locale,
    title: collection.title,
    intro: collection.intro,
    cover: collection.cover ?? null,
    products
  }
}
