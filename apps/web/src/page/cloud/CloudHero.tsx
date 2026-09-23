import styler from '@alinea/styler'
import {CloudButton} from './CloudButton'
import css from './CloudHero.module.scss'
import {cloudDocsUrl, cloudGetStartedUrl} from './CloudLinks'

const styles = styler(css)

export function CloudHero() {
  return (
    <section className={styles.root()}>
      <span className={styles.root.pill()}>
        <span className={styles.root.pill.label()}>Beta</span>
        Free while in beta
      </span>
      <h1 className={styles.root.title()}>
        Your CMS backend,
        <br />
        <span className={styles.root.title.accent()}>handled.</span>
      </h1>
      <p className={styles.root.lead()}>
        Alinea Cloud takes care of the parts git isn't built for: signing in
        your editors, keeping their drafts, and publishing their changes to your
        GitHub repository.
      </p>
      <div className={styles.root.actions()}>
        <CloudButton href={cloudGetStartedUrl}>Get started</CloudButton>
        <CloudButton href={cloudDocsUrl} variant="outline">
          Read the docs
        </CloudButton>
      </div>
    </section>
  )
}
