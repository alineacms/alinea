import styler from '@alinea/styler'
import {Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import type {Metadata, MetadataRoute} from 'next'
import Link from 'next/link'
import {cms} from '@/cms'
import {Breadcrumbs} from '@/layout/Breadcrumbs'
import {NavSidebar} from '@/layout/NavSidebar'
import {CopyMarkdownButton} from '@/page/docs/CopyMarkdownButton'
import {DocBody, DocLead, docHeadings, splitLead} from '@/page/docs/DocBody'
import {DocsIconArrowRight} from '@/page/docs/DocsIcons'
import {renderNodes} from '@/page/docs/DocMarkdown'
import {type DocsNavGroup, type DocsNavItem, DocsNav} from '@/page/docs/DocsNav'
import {DocsSearch} from '@/page/docs/DocsSearch'
import {DocToc} from '@/page/docs/DocToc'
import {Doc} from '@/schema/Doc'
import {getMetadata} from '@/utils/metadata'
import css from './DocPage.module.scss'

const styles = styler(css)

const githubContentUrl =
  'https://github.com/alineacms/alinea/blob/main/apps/web/content'

type DocPageParams = Promise<{
  slug?: Array<string>
}>

interface DocPageProps {
  params: DocPageParams
}

const navSelect = {
  id: Entry.id,
  url: Entry.url,
  title: Entry.title,
  index: Entry.index,
  navigationTitle: Doc.navigationTitle,
  parent: Entry.parentId
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
      filePath: Entry.filePath,
      updatedAt: Entry.updatedAt,
      parents: Query.parents({
        select: {id: Entry.id, title: Entry.title, url: Entry.url}
      })
    }
  })
}

interface DocsTree {
  root: DocsNavItem
  groups: Array<DocsNavGroup & {url: string}>
  urls: Map<string, {url: string}>
}

// The docs sidebar is derived from the content tree: entries directly below
// /docs are the sidebar groups, the docs index is listed in the first group
async function getDocsTree(): Promise<DocsTree> {
  const [root, entries] = await Promise.all([
    cms.get({url: '/docs', select: navSelect}),
    cms.find({location: cms.workspaces.main.pages.docs, select: navSelect})
  ])
  const byParent = new Map<string, typeof entries>()
  for (const entry of entries) {
    const siblings = byParent.get(entry.parent ?? root.id) ?? []
    siblings.push(entry)
    byParent.set(entry.parent ?? root.id, siblings)
  }
  for (const siblings of byParent.values())
    siblings.sort((a, b) =>
      a.index < b.index ? -1 : a.index > b.index ? 1 : 0
    )
  function toItem(entry: (typeof entries)[number]): DocsNavItem {
    return {
      id: entry.id,
      title: entry.navigationTitle || entry.title,
      url: entry.url,
      children: (byParent.get(entry.id) ?? []).map(toItem)
    }
  }
  const rootItem: DocsNavItem = {
    id: root.id,
    title: root.navigationTitle || root.title,
    url: root.url,
    children: []
  }
  const groups = (byParent.get(root.id) ?? []).map((group, i) => {
    const {children} = toItem(group)
    return {
      id: group.id,
      title: group.navigationTitle || group.title,
      url: group.url,
      items: i === 0 ? [rootItem, ...children] : children
    }
  })
  const urls = new Map(
    [root, ...entries].map(entry => [entry.id, {url: entry.url}])
  )
  return {root: rootItem, groups, urls}
}

function flatten(item: DocsNavItem): Array<DocsNavItem> {
  return [item, ...item.children.flatMap(flatten)]
}

// Entry file paths start with the workspace name, the main workspace
// stores its content in content/main
function githubUrl(filePath: string) {
  return `${githubContentUrl}/${filePath.replace(/^\/+/, '')}`
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
  const pages = tree.groups.flatMap(group => group.items.flatMap(flatten))
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
      <div className={styles.root.inner()}>
        <div className={styles.root.sidebar()}>
          <NavSidebar>
            <DocsSearch />
            <DocsNav groups={tree.groups} />
          </NavSidebar>
        </div>
        <div className={styles.root.main()}>
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
            {(prev || next) && (
              <nav aria-label="Pagination" className={styles.root.pager()}>
                {prev && (
                  <Link href={prev.url} className={styles.root.pager.link()}>
                    <span className={styles.root.pager.link.label()}>
                      ← Previous
                    </span>
                    <span className={styles.root.pager.link.title()}>
                      {prev.title}
                    </span>
                  </Link>
                )}
                {next && (
                  <Link
                    href={next.url}
                    className={styles.root.pager.link('next')}
                  >
                    <span className={styles.root.pager.link.label()}>
                      Next →
                    </span>
                    <span className={styles.root.pager.link.title()}>
                      {next.title}
                    </span>
                  </Link>
                )}
              </nav>
            )}
            <footer className={styles.root.footer()}>
              <a
                href={githubUrl(doc.filePath)}
                target="_blank"
                rel="noopener"
                className={styles.root.footer.edit()}
              >
                Edit this page on GitHub
              </a>
              {doc.updatedAt && (
                <span>
                  Last updated{' '}
                  {new Date(doc.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              )}
            </footer>
          </article>
          {headings.length > 0 && (
            <aside className={styles.root.toc()}>
              <DocToc items={headings} />
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}

DocPage.sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const pages = await generateStaticParams()
  return [{url: '/docs', priority: 0.9}].concat(
    pages.map(page => ({url: `/docs/${page.slug.join('/')}`, priority: 0.9}))
  )
}
