import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Button} from '@/layout/Button'
import {Label} from '@/layout/Label'
import {Section} from '@/layout/Section'
import {SectionHeader} from '@/layout/SectionHeader'
import type {CompareCards as CompareCardsSchema} from '@/schema/sections/CompareCards'
import {CheckList} from './CheckList'
import {CodeSnippet} from './CodeSnippet'
import css from './CompareCards.module.scss'
import {resolveLink} from './links'

const styles = styler(css)

export interface CompareCardsProps extends Infer<typeof CompareCardsSchema> {}

export function CompareCards({title, description, cards}: CompareCardsProps) {
  return (
    <Section>
      {title && (
        <SectionHeader title={title} description={description || undefined} />
      )}
      {cards?.length > 0 && (
        <div className={styles.root()}>
          {cards.map(card => {
            const tone = card.tone || 'default'
            const link = resolveLink(card.link)
            return (
              <article key={card._id} className={styles.card(tone)}>
                <div className={styles.card.header()}>
                  {card.title && (
                    <h3 className={styles.card.title()}>{card.title}</h3>
                  )}
                  {card.badge && (
                    <Label
                      size="small"
                      variant={tone === 'accent' ? 'accent' : 'neutral'}
                    >
                      {card.badge}
                    </Label>
                  )}
                </div>
                {card.text && <p className={styles.card.text()}>{card.text}</p>}
                <CheckList
                  items={card.checks}
                  tone={tone === 'outline' ? 'muted' : 'accent'}
                />
                {(card.code || link) && (
                  <div className={styles.card.footer()}>
                    <CodeSnippet code={card.code} />
                    {link && (
                      <Button
                        href={link.href}
                        target={link.target}
                        variant={tone === 'accent' ? 'primary' : 'secondary'}
                        className={styles.card.link()}
                      >
                        {link.label}
                      </Button>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </Section>
  )
}
