import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {DemoCollectionGridBlock} from '@/schema/demo/DemoBlocks'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import type {DemoCollectionCardData} from '../demoData'
import {DemoCollectionCard} from './DemoCollectionCard'
import {DemoContainer} from './DemoContainer'
import {DemoSectionHeader} from './DemoSectionHeader'
import css from './DemoCollectionGrid.module.scss'

const styles = styler(css)

export interface DemoCollectionGridProps extends Infer<
  typeof DemoCollectionGridBlock
> {
  locale: DemoLocale
  cards: Array<DemoCollectionCardData>
}

export function DemoCollectionGrid({
  title,
  text,
  locale,
  cards
}: DemoCollectionGridProps) {
  if (cards.length === 0) return null
  return (
    <section className={styles.DemoCollectionGrid()}>
      <DemoContainer>
        {title && <DemoSectionHeader title={title} text={text} />}
        <div className={styles.DemoCollectionGrid.grid()}>
          {cards.map(collection => (
            <DemoCollectionCard
              key={collection.id}
              locale={locale}
              collection={collection}
            />
          ))}
        </div>
      </DemoContainer>
    </section>
  )
}
