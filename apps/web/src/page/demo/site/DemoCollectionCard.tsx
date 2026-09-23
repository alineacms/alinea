import styler from '@alinea/styler'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import type {DemoCollectionCardData} from '../demoData'
import {demoStrings} from '../demoStrings'
import {DemoImage} from './DemoImage'
import css from './DemoCollectionCard.module.scss'

const styles = styler(css)

export interface DemoCollectionCardProps {
  locale: DemoLocale
  collection: DemoCollectionCardData
}

export function DemoCollectionCard({
  locale,
  collection
}: DemoCollectionCardProps) {
  const t = demoStrings(locale)
  return (
    <a href={collection.url} className={styles.DemoCollectionCard()}>
      <DemoImage
        image={collection.cover}
        ratio="3 / 4"
        className={styles.DemoCollectionCard.image()}
      />
      <div className={styles.DemoCollectionCard.overlay()}>
        <span className={styles.DemoCollectionCard.count()}>
          {t.products(collection.products?.length ?? 0)}
        </span>
        <h3 className={styles.DemoCollectionCard.title()}>
          {collection.title}
        </h3>
      </div>
    </a>
  )
}
