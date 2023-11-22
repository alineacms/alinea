import {BodyView} from '@/blocks/BodyFieldView'
import {cms} from '@/cms'
import {Breadcrumbs} from '@/layout/Breadcrumbs'
import {LayoutWithSidebar} from '@/layout/Layout'
import {FrameworkPicker} from '@/nav/FrameworkPicker'
import {getFramework} from '@/nav/Frameworks'
import {Link} from '@/nav/Link'
import {NavTree} from '@/nav/NavTree'
import {NavItem, nestNav} from '@/nav/NestNav'
import {Doc} from '@/schema/Doc'
import {Entry} from 'alinea/core'
import {HStack, VStack, fromModule} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import css from './page.module.scss'

const styles = fromModule(css)

const summary = {
  id: Entry.entryId,
  title: Entry.title,
  url: Entry.url
}

function getPage(slug: Array<string>) {
  return cms.maybeGet(
    Doc()
      .where(Entry.url.is(`/docs/${slug.map(decodeURIComponent).join('/')}`))
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

export async function generateMetadata({
  params
}: DocPageProps): Promise<Metadata> {
  const page = await getPage(params.slug)
  if (!page) return notFound()
  return {
    title: page.title
  }
}

export interface DocPageProps {
  params: {
    slug: Array<string>
    framework: string
  }
}

export default async function DocPage({params}: DocPageProps) {
  const slug = params.slug.slice()
  const framework = getFramework(params.framework)
  if (params.framework !== framework.selected.name)
    slug.unshift(params.framework)
  console.log(slug)
  const page = await getPage(slug)
  if (!page) return notFound()
  const nav = await cms.in(cms.workspaces.main.pages.docs).find(
    Entry().select({
      id: Entry.entryId,
      type: Entry.type,
      url: Entry.url,
      title: Entry.title,
      parent: Entry.parent
    })
  )
  const nested = nestNav(nav)
  const itemsIn = (item: NavItem): Array<NavItem> =>
    item.children ? [item, ...item.children.flatMap(itemsIn)] : [item]
  const docs = nested.flatMap(itemsIn).filter(page => page.type === 'Doc')
  const index = docs.findIndex(item => item.id === page.id)
  const prev = docs[index - 1]
  const next = docs[index + 1]
  return (
    <LayoutWithSidebar
      sidebar={
        <VStack gap={10}>
          <FrameworkPicker />
          <NavTree nav={nav} />
        </VStack>
      }
    >
      <Breadcrumbs parents={page.parents} />
      <BodyView body={page.body} />
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
            <span className={styles.root.nav.link.icon()}>
              <IcRoundArrowBack />
            </span>
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

            <span className={styles.root.nav.link.icon()}>
              <IcRoundArrowForward />
            </span>
          </Link>
        )}
      </HStack>
    </LayoutWithSidebar>
  )
}
