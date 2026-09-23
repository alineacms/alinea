import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Label} from '@/layout/Label'
import {Section} from '@/layout/Section'
import {SectionHeader} from '@/layout/SectionHeader'
import type {Spotlight as SpotlightSchema} from '@/schema/sections/Spotlight'
import {ArrowLink} from './ArrowLink'
import {CheckList} from './CheckList'
import {CodeSnippet} from './CodeSnippet'
import {resolveLink} from './links'
import {PublishFlow} from './PublishFlow'
import css from './Spotlight.module.scss'

const styles = styler(css)

export interface SpotlightProps extends Infer<typeof SpotlightSchema> {}

export function Spotlight({
  heading,
  intro,
  label,
  title,
  text,
  checks,
  link,
  illustration,
  snippets
}: SpotlightProps) {
  const hasFlow = illustration === 'publishFlow'
  const hasSnippets = Boolean(snippets?.length)
  return (
    <Section>
      {heading && (
        <SectionHeader title={heading} description={intro || undefined} />
      )}
      <div className={styles.root({visual: hasFlow || hasSnippets})}>
        <div className={styles.root.content()}>
          {label && (
            <Label size="small" className={styles.root.label()}>
              {label}
            </Label>
          )}
          {title && <h3 className={styles.root.title()}>{title}</h3>}
          {text && <p className={styles.root.text()}>{text}</p>}
          <CheckList items={checks} />
          <ArrowLink link={resolveLink(link)} />
        </div>
        {(hasFlow || hasSnippets) && (
          <div className={styles.root.visual()}>
            {hasFlow && <PublishFlow />}
            {hasSnippets && (
              <div className={styles.root.snippets()}>
                {snippets.map(snippet => (
                  <CodeSnippet
                    key={snippet._id}
                    size="small"
                    filename={snippet.filename}
                    code={snippet.code}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}
