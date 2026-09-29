import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {DemoFeaturedProductsBlock} from '@/schema/demo/DemoBlocks'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import type {DemoProductCardData} from '../demoData'
import {DemoContainer} from './DemoContainer'
import {DemoProductGrid} from './DemoProductGrid'
import {DemoSectionHeader} from './DemoSectionHeader'
import css from './DemoFeaturedProducts.module.scss'
import {demoLink} from './demoLink'

const styles = styler(css)

export interface DemoFeaturedProductsProps extends Infer<
  typeof DemoFeaturedProductsBlock
> {
  locale: DemoLocale
  cards: Array<DemoProductCardData>
}

export function DemoFeaturedProducts({
  title,
  link,
  locale,
  cards
}: DemoFeaturedProductsProps) {
  if (cards.length === 0) return null
  return (
    <section className={styles.DemoFeaturedProducts()}>
      <DemoContainer>
        <DemoSectionHeader title={title} link={demoLink(link)} />
        <DemoProductGrid locale={locale} products={cards} />
      </DemoContainer>
    </section>
  )
}
