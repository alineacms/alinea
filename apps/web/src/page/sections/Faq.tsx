import styler from '@alinea/styler'
import type {Infer, TextDoc} from 'alinea'
import {RichText} from 'alinea/ui/RichText'
import {StrokeMinus, StrokePlus} from '@/icons'
import {Section} from '@/layout/Section'
import type {Faq as FaqSchema} from '@/schema/sections/Faq'
import css from './Faq.module.scss'

const styles = styler(css)

export interface FaqProps extends Infer<typeof FaqSchema> {}

interface FaqTextProps {
  doc: TextDoc
  className: string
}

function FaqText({doc, className}: FaqTextProps) {
  return (
    <div className={className}>
      <RichText
        doc={doc}
        p={<p className={styles.text.paragraph()} />}
        a={<a className={styles.text.link()} />}
        ul={<ul className={styles.text.list()} />}
        ol={<ol className={styles.text.list()} />}
        li={<li className={styles.text.item()} />}
      />
    </div>
  )
}

export function Faq({title, text, items}: FaqProps) {
  return (
    <Section>
      <div className={styles.root()}>
        <div className={styles.root.intro()}>
          {title && <h2 className={styles.root.title()}>{title}</h2>}
          {text && <FaqText doc={text} className={styles.text('intro')} />}
        </div>
        {items?.length > 0 && (
          <div className={styles.root.list()}>
            {items.map((item, i) => (
              <details key={item._id} className={styles.item()} open={i === 0}>
                <summary className={styles.item.question()}>
                  {item.question}
                  <span className={styles.item.icon()} aria-hidden="true">
                    <StrokePlus className={styles.item.icon.plus()} />
                    <StrokeMinus className={styles.item.icon.minus()} />
                  </span>
                </summary>
                {item.answer && (
                  <FaqText
                    doc={item.answer}
                    className={styles.text('answer')}
                  />
                )}
              </details>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
