import {cms} from '@/cms'
import {Breadcrumbs} from '@/layout/Breadcrumbs'
import {PageWithSidebar} from '@/layout/Page'
import {FrameworkPicker} from '@/layout/nav/FrameworkPicker'
import {supportedFrameworks} from '@/layout/nav/Frameworks'
import {Link} from '@/layout/nav/Link'
import {NavTree} from '@/layout/nav/NavTree'
import {NavItem, nestNav} from '@/layout/nav/NestNav'
import {BodyView} from '@/page/blocks/BodyFieldView'
import {Doc} from '@/schema/Doc'
import {Entry} from 'alinea/core'
import {HStack, VStack, fromModule} from 'alinea/ui'
import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import css from './DocPage.module.scss'

const styles = fromModule(css)

interface DocPageParams {
  slug: Array<string>
  framework: string
}

interface DocPageProps {
  params: DocPageParams
}

const summary = {
  id: Entry.entryId,
  title: Entry.title,
  url: Entry.url
}

async function getPage(params: DocPageParams) {
  const slug = params.slug?.slice() ?? []
  const framework =
    supportedFrameworks.find(f => f.name === params.framework) ??
    supportedFrameworks[0]
  if (params.framework && framework.name !== params.framework)
    slug.unshift(params.framework)
  const pathname = slug.map(decodeURIComponent).join('/')
  const url = pathname ? `/docs/${pathname}` : '/docs'
  return {
    framework,
    doc: await cms.maybeGet(
      Entry()
        .where(Entry.url.is(url))
        .select({
          ...Doc,
          id: Entry.entryId,
          level: Entry.level,
          parents({parents}) {
            return parents().select(summary)
          }
        })
    )
  }
}

export const dynamicParams = false
export async function generateStaticParams() {
  const urls = await cms
    .in(cms.workspaces.main.pages.docs)
    .find(Entry().select(Entry.url))
  return urls.flatMap(url => {
    return supportedFrameworks
      .map(framework => {
        return {
          framework: framework.name,
          slug: url.split('/').slice(2)
        }
      })
      .concat({
        framework: url.split('/')[2],
        slug: url.split('/').slice(3)
      })
  })
}

export async function generateMetadata({
  params
}: DocPageProps): Promise<Metadata> {
  const {doc} = await getPage(params)
  if (!doc) return notFound()
  return {title: doc.title}
}

export default async function DocPage({params}: DocPageProps) {
  const {doc, framework} = await getPage(params)
  if (!doc) return notFound()
  const select = {
    id: Entry.entryId,
    type: Entry.type,
    url: Entry.url,
    title: Entry.title,
    navigationTitle: Doc.navigationTitle,
    parent: Entry.parent
  }
  const root = await cms.get(Entry({url: '/docs'}).select(select))
  const nav = await cms
    .in(cms.workspaces.main.pages.docs)
    .find(Entry().select(select))
  const nested = nestNav(
    [
      root,
      ...nav.map(item => ({
        ...item,
        parent: item.parent === root.id ? null : item.parent
      }))
    ].map(item => ({
      ...item,
      title: item.navigationTitle ?? item.title
    }))
  )
  const itemsIn = (item: NavItem): Array<NavItem> =>
    item.children ? [item, ...item.children.flatMap(itemsIn)] : [item]
  const docs = nested.flatMap(itemsIn)
  const index = docs.findIndex(item => item.id === doc.id)
  const prev = docs[index - 1]
  const next = docs[index + 1]
  return (
    <PageWithSidebar
      sidebar={
        <VStack gap={10}>
          <FrameworkPicker />
          <NavTree nav={nested} />
        </VStack>
      }
    >
      <Breadcrumbs parents={doc.parents.slice(-1)} />
      <BodyView body={doc.body} />
      <HStack
        gap={20}
        justify="space-between"
        wrap
        className={styles.root.nav()}
      >
        {prev?.url && (
          <Link
            href={framework.link(prev.url)}
            className={styles.root.nav.link()}
          >
            {/*<span className={styles.root.nav.link.icon()}>
              <IcRoundArrowBack />
             </span>*/}
            <VStack gap={4}>
              <span className={styles.root.nav.link.label()}>Previous</span>
              <span className={styles.root.nav.link.title()}>{prev.title}</span>
            </VStack>
          </Link>
        )}
        {next?.url && (
          <Link
            href={framework.link(next.url)}
            className={styles.root.nav.link('right')}
          >
            <VStack gap={4}>
              <span className={styles.root.nav.link.label()}>Next</span>
              <span className={styles.root.nav.link.title()}>{next.title}</span>
            </VStack>

            {/*<span className={styles.root.nav.link.icon()}>
              <IcRoundArrowForward />
             </span>*/}
          </Link>
        )}
      </HStack>
    </PageWithSidebar>
  )
}
