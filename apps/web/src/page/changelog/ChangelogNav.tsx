import styler from '@alinea/styler'
import css from './ChangelogNav.module.scss'
import {type ChangelogRelease, formatReleaseDate} from './parseChangelog'

const styles = styler(css)

export interface ChangelogNavProps {
  releases: Array<ChangelogRelease>
}

export function ChangelogNav({releases}: ChangelogNavProps) {
  return (
    <nav aria-label="Releases" className={styles.root()}>
      <span className={styles.title()}>Releases</span>
      <div className={styles.list()}>
        {releases.map((release, index) => {
          const isLatest = index === 0
          return (
            <a
              key={release.version}
              href={`#${release.version}`}
              className={styles.link({latest: isLatest})}
            >
              <span>{release.version}</span>
              {isLatest ? (
                <span className={styles.link.latest()}>Latest</span>
              ) : (
                release.date && (
                  <span className={styles.link.date()}>
                    {formatReleaseDate(release.date, true)}
                  </span>
                )
              )}
            </a>
          )
        })}
      </div>
      <a
        href="https://github.com/alineacms/alinea/releases"
        className={styles.all()}
      >
        All releases on GitHub →
      </a>
    </nav>
  )
}
