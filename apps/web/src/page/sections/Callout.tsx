import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Button} from '@/layout/Button'
import {Label} from '@/layout/Label'
import {Section} from '@/layout/Section'
import type {Callout as CalloutSchema} from '@/schema/sections/Callout'
import css from './Callout.module.scss'
import {resolveLink} from './links'

const styles = styler(css)

export interface CalloutProps extends Infer<typeof CalloutSchema> {}

/** A bordered panel with a title, a short text and an action on the side */
export function Callout({title, badge, text, link}: CalloutProps) {
  const action = resolveLink(link)
  return (
    <Section>
      <div className={styles.root()}>
        <div className={styles.root.content()}>
          {(title || badge) && (
            <div className={styles.root.heading()}>
              {title && <h2 className={styles.root.title()}>{title}</h2>}
              {badge && <Label>{badge}</Label>}
            </div>
          )}
          {text && <p className={styles.root.text()}>{text}</p>}
        </div>
        {action && (
          <Button
            href={action.href}
            target={action.target}
            className={styles.root.action()}
          >
            {action.label}
          </Button>
        )}
      </div>
    </Section>
  )
}
