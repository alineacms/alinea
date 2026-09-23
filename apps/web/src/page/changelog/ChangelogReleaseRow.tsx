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
        {release.date && (
          <time dateTime={release.date} className={styles.meta.date()}>
            {formatReleaseDate(release.date)}
          </time>
        )}
        {isLatest && <span className={styles.meta.latest()}>Latest</span>}
      </div>
      <div className={styles.groups()}>
        {release.groups.map((group, index) => (
          <div key={index} className={styles.group()}>
            {group.label && (
              <span className={styles.group.label(group.kind ?? 'other')}>
                {group.label}
              </span>
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
      </div>
    </section>
  )
}
