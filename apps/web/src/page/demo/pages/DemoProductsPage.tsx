import styler from '@alinea/styler'
import {Query} from 'alinea'
import type {Graph} from 'alinea/core/Graph'
import {DemoProducts} from '@/schema/demo'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import {
  type DemoProductCardData,
  type DemoTarget,
  findProductCards,
  targetLocale,
  targetQuery
} from '../demoData'
import {DemoContainer} from '../site/DemoContainer'
import {DemoPageIntro} from '../site/DemoPageIntro'
import {DemoProductGrid} from '../site/DemoProductGrid'
import css from './DemoProductsPage.module.scss'

const styles = styler(css)

export interface DemoProductsPageProps {
  locale: DemoLocale
  title: string
  intro: string
  products: Array<DemoProductCardData>
}

export function DemoProductsPage({
  locale,
  title,
  intro,
  products
}: DemoProductsPageProps) {
  return (
    <div className={styles.DemoProductsPage()}>
      <DemoPageIntro title={title} intro={intro} />
      <DemoContainer>
        <DemoProductGrid locale={locale} products={products} />
      </DemoContainer>
    </div>
  )
}

DemoProductsPage.query = async (
  graph: Graph,
  target: DemoTarget
): Promise<DemoProductsPageProps> => {
  const locale = targetLocale(target)
  const page = await graph.get({
    ...targetQuery(target),
    type: DemoProducts,
    select: {
      title: DemoProducts.title,
      intro: DemoProducts.intro,
      children: Query.children({select: Query.id})
    }
  })
  const products = await findProductCards(graph, page.children, locale)
  return {locale, title: page.title, intro: page.intro, products}
}
