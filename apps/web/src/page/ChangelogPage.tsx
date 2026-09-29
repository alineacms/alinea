import {readFile} from 'node:fs/promises'
import path from 'node:path'
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
  // The changelog at the root of the monorepo, read when the page is built
  // so it always matches the release being deployed
  const doc = await readFile(
    path.join(process.cwd(), '../../changelog.md'),
    'utf8'
  )
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
      </header>
      <div className={styles.layout()}>
        <ChangelogNav
          releases={releases.map(({version, date}) => ({version, date}))}
        />
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
