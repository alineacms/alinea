import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Label} from '@/layout/Label'
import {Section} from '@/layout/Section'
import type {CardPair as CardPairSchema} from '@/schema/sections/CardPair'
import css from './CardPair.module.scss'
import {CodeSnippet} from './CodeSnippet'

const styles = styler(css)

export interface CardPairProps extends Infer<typeof CardPairSchema> {}

type Card = CardPairProps['cards'][number]
type CodeCardData = Extract<Card, {_type: 'CodeCard'}>
type BarsCardData = Extract<Card, {_type: 'BarsCard'}>

interface CodeCardProps {
  card: CodeCardData
}

function CodeCard({card}: CodeCardProps) {
  return (
    <article className={styles.card()}>
      {card.title && <h3 className={styles.card.title()}>{card.title}</h3>}
      {card.text && <p className={styles.card.text()}>{card.text}</p>}
      <CodeSnippet filename={card.filename} code={card.code} />
      {card.chips?.length > 0 && (
        <div className={styles.card.chips()}>
          {card.chips.map(chip => (
            <Label key={chip._id} variant="neutral">
              {chip.text}
            </Label>
          ))}
        </div>
      )}
    </article>
  )
}

interface BarsCardProps {
  card: BarsCardData
}

function BarsCard({card}: BarsCardProps) {
  const bars = card.bars ?? []
  const max = Math.max(1, ...bars.map(bar => bar.count ?? 0))
  const summary = bars.map(bar => `${bar.name} ${bar.count ?? 0}`).join(', ')
  return (
    <article className={styles.card()}>
      {card.title && <h3 className={styles.card.title()}>{card.title}</h3>}
      {card.text && <p className={styles.card.text()}>{card.text}</p>}
      {bars.length > 0 && (
        <div
          role="img"
          aria-label={card.title ? `${card.title}: ${summary}` : summary}
          className={styles.bars()}
        >
          {bars.map(bar => {
            const width = Math.max(1.2, ((bar.count ?? 0) / max) * 100)
            return (
              <div
                key={bar._id}
                className={styles.bars.row({highlight: bar.highlight})}
              >
                <span className={styles.bars.label()}>{bar.name}</span>
                <span className={styles.bars.track()}>
                  <span
                    className={styles.bars.fill()}
                    style={{width: `${width.toFixed(1)}%`}}
                  />
                </span>
                <span className={styles.bars.value()}>
                  {bar.count ?? 0}
                  {bar.size && (
                    <span className={styles.bars.size()}> · {bar.size}</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {card.footnote && (
        <p className={styles.card.footnote()}>{card.footnote}</p>
      )}
    </article>
  )
}

export function CardPair({cards, attached}: CardPairProps) {
  if (!cards?.length) return null
  return (
    <Section flush={attached}>
      <div className={styles.root({attached})}>
        {cards.map(card => {
          switch (card._type) {
            case 'CodeCard':
              return <CodeCard key={card._id} card={card} />
            case 'BarsCard':
              return <BarsCard key={card._id} card={card} />
            default:
              return null
          }
        })}
      </div>
    </Section>
  )
}
