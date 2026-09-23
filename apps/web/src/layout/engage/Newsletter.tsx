import styler from '@alinea/styler'
import {VStack} from 'alinea/ui/Stack'
import type {HTMLProps} from 'react'
import {Action} from '../Action'
import {WebTypo} from '../WebTypo'
import css from './Newsletter.module.scss'

const styles = styler(css)

const subscribeUrl =
  'https://codeurs.us7.list-manage.com/subscribe/post?u=8e413112334fb79c0ae78c1da&id=9be892ae30&f_id=00a8efe3f0'

export type NewsletterVariant = 'compact' | 'panel'

export interface NewsletterProps extends HTMLProps<HTMLFormElement> {
  /** The panel variant renders a full width navy block, eg. on the blog */
  variant?: NewsletterVariant
}

export function Newsletter({variant = 'compact', ...props}: NewsletterProps) {
  if (variant === 'panel') return <NewsletterPanel {...props} />
  return (
    <form action={subscribeUrl} method="post" target="_blank" {...props}>
      <VStack gap={12} align="flex-start">
        <WebTypo.P flat>
          Receive important updates <br />
          in your inbox. No spam.
        </WebTypo.P>
        <input
          placeholder="Email address"
          type="email"
          name="EMAIL"
          required
          className={styles.root.email()}
        />
        <Action size={14}>
          <button>Sign up</button>
        </Action>
      </VStack>
    </form>
  )
}

function NewsletterPanel({className, ...props}: HTMLProps<HTMLFormElement>) {
  return (
    <section className={styles.panel(styler.merge({className}))}>
      <div className={styles.panel.intro()}>
        <h2 className={styles.panel.title()}>
          Get release notes in your inbox
        </h2>
        <p className={styles.panel.description()}>
          One email per release. No spam, unsubscribe anytime.
        </p>
      </div>
      <form
        action={subscribeUrl}
        method="post"
        target="_blank"
        className={styles.panel.form()}
        {...props}
      >
        <label className={styles.panel.field()}>
          <span className={styles.panel.field.label()}>Email address</span>
          <input
            placeholder="you@company.com"
            type="email"
            name="EMAIL"
            autoComplete="email"
            required
            className={styles.panel.field.input()}
          />
        </label>
        <button type="submit" className={styles.panel.submit()}>
          Subscribe
        </button>
      </form>
    </section>
  )
}
