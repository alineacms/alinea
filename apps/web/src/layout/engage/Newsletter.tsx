import styler from '@alinea/styler'
import css from './Newsletter.module.scss'

const styles = styler(css)

const subscribeUrl =
  'https://codeurs.us7.list-manage.com/subscribe/post?u=8e413112334fb79c0ae78c1da&id=9be892ae30&f_id=00a8efe3f0'

export interface NewsletterProps {
  className?: string
}

/** A full width tinted band with the newsletter sign up */
export function Newsletter({className}: NewsletterProps) {
  return (
    <section className={styles.root(styler.merge({className}))}>
      <div className={styles.root.inner()}>
        <div className={styles.root.intro()}>
          <h2 className={styles.root.title()}>
            Get release notes in your inbox
          </h2>
          <p className={styles.root.description()}>
            One email per release. No spam, unsubscribe anytime.
          </p>
        </div>
        <form
          action={subscribeUrl}
          method="post"
          target="_blank"
          className={styles.root.form()}
        >
          <label className={styles.root.field()}>
            <span className={styles.root.field.label()}>Email address</span>
            <input
              placeholder="you@company.com"
              type="email"
              name="EMAIL"
              autoComplete="email"
              required
              className={styles.root.field.input()}
            />
          </label>
          <button type="submit" className={styles.root.submit()}>
            Subscribe
          </button>
        </form>
      </div>
    </section>
  )
}
