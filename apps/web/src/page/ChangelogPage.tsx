import styler from '@alinea/styler'
import type {Metadata, MetadataRoute} from 'next'
import {remark} from 'remark'
import html from 'remark-html'
import {PageContainer, PageContent} from '@/layout/Page'
import {getMetadata, type MetadataProps} from '@/utils/metadata'
import css from './ChangelogPage.module.scss'

const styles = styler(css)

export async function generateMetadata(): Promise<Metadata> {
  return await getMetadata({
    url: '/changelog',
    title: 'Changelog'
  } as MetadataProps)
}

async function markdownToHtml(markdown: string) {
  const result = await remark().use(html).process(markdown)
  return result.toString()
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
  const content = await markdownToHtml(doc)
  return (
    <PageContainer>
      <PageContent>
        <div
          className={styles.root()}
          dangerouslySetInnerHTML={{__html: content}}
        />
      </PageContent>
    </PageContainer>
  )
}

Changelog.sitemap = (): MetadataRoute.Sitemap => {
  return [{url: '/changelog', priority: 0.5}]
}
