import {cms} from '@/cms'
import {Breadcrumbs} from '@/layout/Breadcrumbs'
import {PageWithSidebar} from '@/layout/Page'
import {FrameworkPicker} from '@/layout/nav/FrameworkPicker'
import {supportedFrameworks} from '@/layout/nav/Frameworks'
import {Link} from '@/layout/nav/Link'
import {NavTree} from '@/layout/nav/NavTree'
import {NavItem, nestNav} from '@/layout/nav/NestNav'
import {BodyFieldView} from '@/page/blocks/BodyFieldView'
import {Doc} from '@/schema/Doc'
import styler from '@alinea/styler'
import {Query} from 'alinea'
import {HStack, VStack} from 'alinea/ui'
import {Metadata, MetadataRoute} from 'next'
import {WebTypo} from '../layout/WebTypo'
import css from './DocPage.module.scss'

const styles = styler(css)

interface DocPageParams {
  slug: Array<string>
  framework: string
}

interface DocPageProps {
  params: DocPageParams
}

const summary = {
  id: Query.id,
  title: Query.title,
  url: Query.url
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
    doc: await cms.get(
      Query.whereUrl(url).select({
        ...Doc,
        id: Query.id,
        level: Query.level,
        parents: Query.parents().select(summary)
      })
    )
  }
}

export const dynamicParams = false
export async function generateStaticParams() {
  const urls = await cms
    .in(cms.workspaces.main.pages.docs)
    .find(Query.select(Query.url))
  return urls
    .flatMap(url => {
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
    .concat(
      supportedFrameworks.map(framework => {
        return {
          framework: framework.name,
          slug: []
        }
      })
    )
}

export async function generateMetadata({
  params
}: DocPageProps): Promise<Metadata> {
  const {doc} = await getPage(params)
  return {title: doc.title}
}

export default async function DocPage({params}: DocPageProps) {
  const {doc, framework} = await getPage(params)
  const select = {
    id: Query.id,
    type: Query.type,
    url: Query.url,
    title: Query.title,
    navigationTitle: Doc.navigationTitle,
    parent: Query.parent
  }
  const root = await cms.get(Query.whereUrl('/docs').select(select))
  const nav = await cms
    .in(cms.workspaces.main.pages.docs)
    .find(Query.select(select))
  const entries = [
    root,
    ...nav.map(item => ({
      ...item,
      parent: item.parent === root.id ? null : item.parent
    }))
  ].map(item => ({
    ...item,
    title: item.navigationTitle || item.title
  }))
  const nested = nestNav(entries)
  const directChildren = entries.filter(item => item.parent === doc.id)
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
      <WebTypo>
        <WebTypo.H1>{doc.navigationTitle || doc.title}</WebTypo.H1>
        <VStack
          as="ul"
          gap={12}
          align="flex-start"
          className={styles.root.subNav()}
        >
          {directChildren.map(child => {
            return (
              <li key={child.id} className={styles.root.subNav.link()}>
                <WebTypo.Link href={child.url}>{child.title}</WebTypo.Link>
              </li>
            )
          })}
        </VStack>
        <BodyFieldView body={doc.body} />
      </WebTypo>
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

DocPage.sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const pages = await generateStaticParams()
  return pages
    .filter(page => supportedFrameworks.some(f => f.name === page.framework))
    .map(page => {
      return {
        url: `/${
          page.framework === 'next' ? 'docs' : `docs:${page.framework}`
        }/${page.slug.join('/')}`,
        priority: 0.9
      }
    })
}
