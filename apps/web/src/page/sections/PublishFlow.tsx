import styler from '@alinea/styler'
import {StrokeHistory} from '@/icons'
import css from './PublishFlow.module.scss'

const styles = styler(css)

function Arrow() {
  return (
    <span className={styles.root.arrow()} aria-hidden="true">
      →
    </span>
  )
}

/** Compares publishing in a typical git-based CMS with Alinea */
export function PublishFlow() {
  return (
    <div className={styles.root()}>
      <div className={styles.root.row()}>
        <span className={styles.root.title()}>A typical git-based CMS</span>
        <div className={styles.root.steps()}>
          <span className={styles.root.step()}>Publish</span>
          <Arrow />
          <span className={styles.root.step()}>Commit</span>
          <Arrow />
          <span className={styles.root.step('waiting')}>
            <StrokeHistory className={styles.root.icon()} />
            Waiting for CI to rebuild the site
          </span>
          <Arrow />
          <span className={styles.root.step('muted')}>Live</span>
        </div>
      </div>
      <div className={styles.root.row('alinea')}>
        <span className={styles.root.title()}>Alinea</span>
        <div className={styles.root.steps()}>
          <span className={styles.root.step()}>Publish</span>
          <Arrow />
          <span className={styles.root.step()}>Commit</span>
          <Arrow />
          <span className={styles.root.step('live')}>
            <span className={styles.root.dot()} />
            Live
          </span>
          <span className={styles.root.spacer()} />
          <span className={styles.root.step('skipped')}>CI build</span>
        </div>
      </div>
    </div>
  )
}
