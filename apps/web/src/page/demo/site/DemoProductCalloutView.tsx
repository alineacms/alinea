import styler from '@alinea/styler'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import type {DemoProductCardData} from '../demoData'
import {demoStrings, formatPrice} from '../demoStrings'
import {DemoImage} from './DemoImage'
import css from './DemoProductCalloutView.module.scss'

const styles = styler(css)

export interface DemoProductCalloutViewProps {
  locale: DemoLocale
  product: DemoProductCardData
  note?: string
}

/** A product highlighted inside a journal article */
export function DemoProductCalloutView({
  locale,
  product,
  note
}: DemoProductCalloutViewProps) {
  const t = demoStrings(locale)
  return (
    <aside className={styles.DemoProductCalloutView()}>
      <a href={product.url} className={styles.DemoProductCalloutView.media()}>
        <DemoImage image={product.gallery?.[0]} ratio="1 / 1" />
      </a>
      <div className={styles.DemoProductCalloutView.body()}>
        <a href={product.url} className={styles.DemoProductCalloutView.title()}>
          {product.title}
        </a>
        {note && <p className={styles.DemoProductCalloutView.note()}>{note}</p>}
        <p className={styles.DemoProductCalloutView.meta()}>
          <span>{formatPrice(locale, product.price)}</span>
          <a
            href={product.url}
            className={styles.DemoProductCalloutView.link()}
          >
            {t.viewProduct} →
          </a>
        </p>
      </div>
    </aside>
  )
}
