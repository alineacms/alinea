import styler from '@alinea/styler'
import {Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import type {Metadata, MetadataRoute} from 'next'
import Link from 'next/link'
import {cms} from '@/cms'
import {Breadcrumbs} from '@/layout/Breadcrumbs'
import {CopyMarkdownButton} from '@/page/docs/CopyMarkdownButton'
import {DocBody, DocLead, docHeadings, splitLead} from '@/page/docs/DocBody'
import {DocsFooter} from '@/page/docs/DocsFooter'
import {DocsIconArrowRight} from '@/page/docs/DocsIcons'
import {renderNodes} from '@/page/docs/DocMarkdown'
import {docsPages, getDocsTree} from '@/page/docs/DocsTree'
import {DocToc} from '@/page/docs/DocToc'
import {Doc} from '@/schema/Doc'
import {getMetadata} from '@/utils/metadata'
import css from './DocPage.module.scss'

const styles = styler(css)

type DocPageParams = Promise<{
  slug?: Array<string>
}>

interface DocPageProps {
  params: DocPageParams
}

async function getDoc(params: DocPageParams) {
  const {slug = []} = await params
  const pathname = slug.map(decodeURIComponent).join('/')
  const url = pathname ? `/docs/${pathname}` : '/docs'
  return cms.get({
    url,
    include: {
      ...Doc,
      id: Entry.id,
      parents: Query.parents({
        select: {id: Entry.id, title: Entry.title, url: Entry.url}
      })
    }
  })
}

export const dynamicParams = false
export async function generateStaticParams() {
  const urls = await cms.find({
    location: cms.workspaces.main.pages.docs,
    select: Entry.url
  })
  return urls.map(url => ({slug: url.split('/').slice(2)}))
}

export async function generateMetadata({
  params
}: DocPageProps): Promise<Metadata> {
  const doc = await getDoc(params)
  return await getMetadata({
    url: doc._url,
    title: doc.title,
    metadata: doc.metadata
  })
}

export default async function DocPage({params}: DocPageProps) {
  const [doc, tree] = await Promise.all([getDoc(params), getDocsTree()])
  const isIndex = doc.id === tree.root.id
  const title = isIndex ? doc.navigationTitle || doc.title : doc.title
  const pages = docsPages(tree)
  const index = pages.findIndex(page => page.id === doc.id)
  const prev = index > 0 ? pages[index - 1] : undefined
  const next = index > -1 ? pages[index + 1] : undefined
  const group = tree.groups.find(group => group.id === doc.id)
  const children = group
    ? group.items
    : (pages.find(page => page.id === doc.id)?.children ?? [])
  const firstGroup = tree.groups[0]
  const parents = isIndex
    ? firstGroup
      ? [{id: firstGroup.id, title: firstGroup.title, url: firstGroup.url}]
      : []
    : doc.parents.filter(parent => parent.id !== tree.root.id)
  const {lead, rest} = splitLead(doc.body)
  const headings = docHeadings(rest)
  const markdown = [`# ${title}`, renderNodes(doc.body, tree.urls, new Map())]
    .filter(Boolean)
    .join('\n\n')
  return (
    <div className={styles.root()}>
      <article className={styles.root.article()}>
        <div className={styles.root.top()}>
          <Breadcrumbs
            parents={parents}
            current={doc.navigationTitle || doc.title}
          />
          <CopyMarkdownButton markdown={markdown} />
        </div>
        <header className={styles.root.header()}>
          <h1 className={styles.root.title()}>{title}</h1>
          {lead && <DocLead doc={lead} />}
        </header>
        <DocBody body={rest} />
        {children.length > 0 && (
          <section className={styles.root.section()}>
            <h2 className={styles.root.section.title()}>In this section</h2>
            <div className={styles.root.section.grid()}>
              {children.map(child => (
                <Link
                  key={child.id}
                  href={child.url}
                  className={styles.root.section.card()}
                >
                  <span>{child.title}</span>
                  <DocsIconArrowRight
                    className={styles.root.section.card.icon()}
                  />
                </Link>
              ))}
            </div>
          </section>
        )}
        <DocsFooter prev={prev} next={next} />
      </article>
      {/* Always rendered so the article has the same width on every page */}
      <aside className={styles.root.toc()}>
        {headings.length > 0 && <DocToc items={headings} />}
      </aside>
    </div>
  )
}

DocPage.sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const pages = await generateStaticParams()
  return [{url: '/docs', priority: 0.9}].concat(
    pages.map(page => ({url: `/docs/${page.slug.join('/')}`, priority: 0.9}))
  )
}
