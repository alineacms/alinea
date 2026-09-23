import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Section} from '@/layout/Section'
import {SectionHeader} from '@/layout/SectionHeader'
import type {Steps as StepsSchema} from '@/schema/sections/Steps'
import {CodeSnippet} from './CodeSnippet'
import {StepVisual} from './StepVisual'
import css from './Steps.module.scss'

const styles = styler(css)

export interface StepsProps extends Infer<typeof StepsSchema> {}

interface CodeChipProps {
  code: string
}

/** A single line of code, the part before `=` is highlighted */
function CodeChip({code}: CodeChipProps) {
  const index = code.indexOf('=')
  return (
    <code className={styles.step.chip()}>
      {index > 0 ? (
        <>
          <span className={styles.step.chip.key()}>{code.slice(0, index)}</span>
          {code.slice(index)}
        </>
      ) : (
        code
      )}
    </code>
  )
}

export function Steps({title, description, numbered, steps}: StepsProps) {
  return (
    <Section>
      {title && (
        <SectionHeader title={title} description={description || undefined} />
      )}
      {steps?.length > 0 && (
        <div className={styles.root()}>
          {steps.map((step, i) => {
            const visual =
              step.visual && step.visual !== 'none' ? step.visual : undefined
            const number = String(i + 1)
            return (
              <article
                key={step._id}
                className={styles.step({visual: Boolean(visual)})}
              >
                {visual === 'code' ? (
                  <CodeSnippet
                    code={step.code}
                    className={styles.step.code()}
                  />
                ) : visual ? (
                  <StepVisual visual={visual} />
                ) : null}
                <div className={styles.step.body()}>
                  {numbered ? (
                    <span className={styles.step.number()}>{number}</span>
                  ) : (
                    <span className={styles.step.index()}>
                      {number.padStart(2, '0')}
                    </span>
                  )}
                  {step.title && (
                    <h3 className={styles.step.title()}>{step.title}</h3>
                  )}
                  {step.text && (
                    <p className={styles.step.text()}>{step.text}</p>
                  )}
                  {visual !== 'code' && step.code && (
                    <CodeChip code={step.code.trim()} />
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </Section>
  )
}
