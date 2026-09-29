import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {DemoQuoteBlock} from '@/schema/demo/DemoBlocks'
import {DemoContainer} from './DemoContainer'
import css from './DemoQuote.module.scss'

const styles = styler(css)

export interface DemoQuoteProps extends Infer<typeof DemoQuoteBlock> {}

export function DemoQuote({quote, author, source}: DemoQuoteProps) {
  return (
    <section className={styles.DemoQuote()}>
      <DemoContainer width="narrow">
        <figure className={styles.DemoQuote.figure()}>
          <span className={styles.DemoQuote.mark()} aria-hidden="true">
            “
          </span>
          <blockquote className={styles.DemoQuote.quote()}>{quote}</blockquote>
          {(author || source) && (
            <figcaption className={styles.DemoQuote.caption()}>
              {author && (
                <span className={styles.DemoQuote.author()}>{author}</span>
              )}
              {source && (
                <span className={styles.DemoQuote.source()}>{source}</span>
              )}
            </figcaption>
          )}
        </figure>
      </DemoContainer>
    </section>
  )
}
