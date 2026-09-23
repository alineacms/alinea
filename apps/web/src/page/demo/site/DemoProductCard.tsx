import styler from '@alinea/styler'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import type {DemoProductCardData} from '../demoData'
import {demoStrings, formatPrice} from '../demoStrings'
import {DemoImage} from './DemoImage'
import css from './DemoProductCard.module.scss'

const styles = styler(css)

export interface DemoProductCardProps {
  locale: DemoLocale
  product: DemoProductCardData
}

export function DemoProductCard({locale, product}: DemoProductCardProps) {
  const t = demoStrings(locale)
  const finishes = product.finishes ?? []
  const surcharges = finishes.map(finish => finish.surcharge ?? 0)
  const varies = surcharges.some(surcharge => surcharge > 0)
  const price = product.price ?? 0
  return (
    <a href={product.url} className={styles.DemoProductCard()}>
      <div className={styles.DemoProductCard.media()}>
        <DemoImage
          image={product.gallery?.[0]}
          ratio="4 / 5"
          className={styles.DemoProductCard.image()}
        />
        {product.badge && (
          <span className={styles.DemoProductCard.badge()}>
            {product.badge}
          </span>
        )}
      </div>
      <div className={styles.DemoProductCard.body()}>
        <div className={styles.DemoProductCard.row()}>
          <h3 className={styles.DemoProductCard.title()}>{product.title}</h3>
          <span className={styles.DemoProductCard.price()}>
            {varies && (
              <span className={styles.DemoProductCard.price.from()}>
                {t.from}{' '}
              </span>
            )}
            {formatPrice(locale, price)}
          </span>
        </div>
        {product.tagline && (
          <p className={styles.DemoProductCard.tagline()}>{product.tagline}</p>
        )}
        {finishes.length > 1 && (
          <div
            className={styles.DemoProductCard.swatches()}
            title={t.finishes(finishes.length)}
          >
            {finishes.map(finish => (
              <span
                key={finish._id}
                className={styles.DemoProductCard.swatch()}
                style={{background: finish.swatch}}
                title={finish.name}
              />
            ))}
          </div>
        )}
      </div>
    </a>
  )
}
