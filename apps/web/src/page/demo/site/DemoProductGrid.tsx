import styler from '@alinea/styler'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import type {DemoProductCardData} from '../demoData'
import {DemoProductCard} from './DemoProductCard'
import css from './DemoProductGrid.module.scss'

const styles = styler(css)

export interface DemoProductGridProps {
  locale: DemoLocale
  products: Array<DemoProductCardData>
}

/** Product cards in a responsive grid */
export function DemoProductGrid({locale, products}: DemoProductGridProps) {
  return (
    <div className={styles.DemoProductGrid()}>
      {products.map(product => (
        <DemoProductCard key={product.id} locale={locale} product={product} />
      ))}
    </div>
  )
}
