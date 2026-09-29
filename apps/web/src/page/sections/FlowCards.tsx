import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Section} from '@/layout/Section'
import type {FlowCards as FlowCardsSchema} from '@/schema/sections/FlowCards'
import css from './FlowCards.module.scss'
import {SectionIcon} from './SectionIcon'

const styles = styler(css)

export interface FlowCardsProps extends Infer<typeof FlowCardsSchema> {}

/** A row of cards following the hero, one of them can be highlighted */
export function FlowCards({items}: FlowCardsProps) {
  if (!items?.length) return null
  return (
    <Section flush>
      <div className={styles.root()}>
        {items.map(item => (
          <article
            key={item._id}
            className={styles.card({highlight: item.highlight})}
          >
            {item.icon && (
              <span className={styles.card.icon()}>
                <SectionIcon name={item.icon} />
              </span>
            )}
            {item.title && (
              <h3 className={styles.card.title()}>{item.title}</h3>
            )}
            {item.text && <p className={styles.card.text()}>{item.text}</p>}
          </article>
        ))}
      </div>
    </Section>
  )
}
