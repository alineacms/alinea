import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {DemoNewsletterBlock} from '@/schema/demo/DemoBlocks'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import {demoStrings} from '../demoStrings'
import {DemoButton} from './DemoButton'
import {DemoContainer} from './DemoContainer'
import css from './DemoNewsletter.module.scss'

const styles = styler(css)

export interface DemoNewsletterProps extends Infer<typeof DemoNewsletterBlock> {
  locale: DemoLocale
}

export function DemoNewsletter({
  locale,
  title,
  text,
  buttonLabel,
  note
}: DemoNewsletterProps) {
  const t = demoStrings(locale)
  return (
    <section className={styles.DemoNewsletter()}>
      <DemoContainer>
        <div className={styles.DemoNewsletter.panel()}>
          <div className={styles.DemoNewsletter.content()}>
            <h2 className={styles.DemoNewsletter.title()}>{title}</h2>
            {text && <p className={styles.DemoNewsletter.text()}>{text}</p>}
          </div>
          <form
            className={styles.DemoNewsletter.form()}
            action="#"
            aria-label={title}
          >
            <div className={styles.DemoNewsletter.fields()}>
              <input
                className={styles.DemoNewsletter.input()}
                type="email"
                name="email"
                placeholder={t.emailPlaceholder}
                aria-label={t.emailPlaceholder}
              />
              <DemoButton type="submit" variant="light">
                {buttonLabel}
              </DemoButton>
            </div>
            {note && <p className={styles.DemoNewsletter.note()}>{note}</p>}
          </form>
        </div>
      </DemoContainer>
    </section>
  )
}
