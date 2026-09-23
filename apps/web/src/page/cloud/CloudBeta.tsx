import styler from '@alinea/styler'
import css from './CloudBeta.module.scss'
import {CloudButton} from './CloudButton'
import {cloudGetStartedUrl} from './CloudLinks'

const styles = styler(css)

export function CloudBeta() {
  return (
    <section className={styles.root()}>
      <div className={styles.root.panel()}>
        <div className={styles.root.content()}>
          <div className={styles.root.heading()}>
            <h2 className={styles.root.title()}>Free while in beta</h2>
            <span className={styles.root.badge()}>Beta</span>
          </div>
          <p className={styles.root.text()}>
            Alinea Cloud is in beta, and every feature is free to use while it
            is. [Add what happens after the beta, and how much notice people
            get.]
          </p>
        </div>
        <CloudButton href={cloudGetStartedUrl}>Get started</CloudButton>
      </div>
    </section>
  )
}
