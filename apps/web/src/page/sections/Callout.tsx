import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Button} from '@/layout/Button'
import {Label} from '@/layout/Label'
import type {Callout as CalloutSchema} from '@/schema/sections/Callout'
import {Band} from './Band'
import css from './Callout.module.scss'
import {resolveLink} from './links'

const styles = styler(css)

export interface CalloutProps extends Infer<typeof CalloutSchema> {}

/** A title, a short text and an action on a tinted band */
export function Callout({title, badge, text, link}: CalloutProps) {
  const action = resolveLink(link)
  return (
    <Band>
      <div className={styles.root()}>
        {(title || badge) && (
          <div className={styles.root.heading()}>
            {title && <h2 className={styles.root.title()}>{title}</h2>}
            {badge && <Label>{badge}</Label>}
          </div>
        )}
        {text && <p className={styles.root.text()}>{text}</p>}
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
    </Band>
  )
}
