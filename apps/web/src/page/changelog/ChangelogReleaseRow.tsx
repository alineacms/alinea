import styler from '@alinea/styler'
import {ChangelogMarkdown} from './ChangelogMarkdown'
import css from './ChangelogReleaseRow.module.scss'
import {type ChangelogRelease, formatReleaseDate} from './parseChangelog'

const styles = styler(css)

export interface ChangelogReleaseRowProps {
  release: ChangelogRelease
  isLatest?: boolean
}

export function ChangelogReleaseRow({
  release,
  isLatest = false
}: ChangelogReleaseRowProps) {
  return (
    <section id={release.version} className={styles.root({latest: isLatest})}>
      <div className={styles.meta()}>
        <h2 className={styles.meta.version()}>{release.version}</h2>
        {(release.date || isLatest) && (
          <p className={styles.meta.line()}>
            {release.date && (
              <time dateTime={release.date}>
                {formatReleaseDate(release.date)}
              </time>
            )}
            {release.date && isLatest && ' · '}
            {isLatest && <span className={styles.meta.latest()}>Latest</span>}
          </p>
        )}
      </div>
      {release.groups.map((group, index) => (
        <div key={index} className={styles.group()}>
          {group.label && (
            <h3 className={styles.group.label()}>{group.label}</h3>
          )}
          <ul className={styles.group.list()}>
            {group.items.map((item, index) => (
              <li key={index} className={styles.group.list.item()}>
                <ChangelogMarkdown source={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
