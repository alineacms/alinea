import styler from '@alinea/styler'
import type {Metadata, MetadataRoute} from 'next'
import {ChangelogNav} from '@/page/changelog/ChangelogNav'
import {ChangelogReleaseRow} from '@/page/changelog/ChangelogReleaseRow'
import {parseChangelog} from '@/page/changelog/parseChangelog'
import {getMetadata, type MetadataProps} from '@/utils/metadata'
import css from './ChangelogPage.module.scss'

const styles = styler(css)

export async function generateMetadata(): Promise<Metadata> {
  return await getMetadata({
    url: '/changelog',
    title: 'Changelog'
  } as MetadataProps)
}

export const dynamic = 'force-static'

export default async function Changelog() {
  const doc = await fetch(
    'https://raw.githubusercontent.com/alineacms/alinea/refs/heads/main/changelog.md',
    {
      next: {
        revalidate: 60 * 60 // 1 hour
      }
    }
  ).then(res => res.text())
  const releases = parseChangelog(doc)
  return (
    <div className={styles.root()}>
      <header className={styles.header()}>
        <div className={styles.header.intro()}>
          <h1 className={styles.header.title()}>What's new</h1>
          <p className={styles.header.description()}>
            Every release, what changed and why it matters.
          </p>
        </div>
        <a
          href="https://github.com/alineacms/alinea/issues"
          className={styles.header.roadmap()}
        >
          Roadmap on GitHub →
        </a>
      </header>
      <div className={styles.layout()}>
        <ChangelogNav releases={releases} />
        <div className={styles.releases()}>
          {releases.map((release, index) => (
            <ChangelogReleaseRow
              key={release.version}
              release={release}
              isLatest={index === 0}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

Changelog.sitemap = (): MetadataRoute.Sitemap => {
  return [{url: '/changelog', priority: 0.5}]
}
