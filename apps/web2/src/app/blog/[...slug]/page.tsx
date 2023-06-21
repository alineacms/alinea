import {cms} from '@/cms'
import {Doc} from '@/schema/Doc'
import {Page} from 'alinea/core'
import {HStack, VStack, fromModule} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import {BlocksView} from '../../../BlocksView'
import {Breadcrumbs} from '../../../layout/Breadcrumbs'
import {LayoutWithSidebar} from '../../../layout/Layout'
import {Link} from '../../../nav/Link'
import {NavTree} from '../../../nav/NavTree'
import {NavItem, nestNav} from '../../../nav/NestNav'
import css from './page.module.scss'

const styles = fromModule(css)

export interface DocPageProps {
  params: {
    slug: Array<string>
  }
}

export default async function DocPage({params}: DocPageProps) {
  const summary = {
    id: Page.entryId,
    title: Page.title,
    url: Page.url
  }
  const page = await cms.maybeGet(
    Doc()
      .where(Page.url.is(`/docs/${params.slug.join('/')}`))
      .select({
        ...Doc,
        id: Page.entryId,
        level: Page.level,
        parents({parents}) {
          return parents().select(summary)
        }
      })
  )
  if (!page) return <div>404</div>
  const nav = await cms.find(
    cms.workspaces.main.pages.docs,
    Page().select({
      id: Page.entryId,
      type: Page.type,
      url: Page.url,
      title: Page.title,
      parent: Page.parent
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
    <LayoutWithSidebar sidebar={<NavTree nav={nav} />}>
      <Breadcrumbs parents={page.parents} />
      <BlocksView blocks={page.blocks} />
      <HStack gap={20} justify="space-between" className={styles.root.nav()}>
        {prev?.url && (
          <Link href={prev.url} className={styles.root.nav.link()}>
            <VStack gap={4}>
              <HStack gap={8}>
                <span className={styles.root.nav.link.icon()}>
                  <IcRoundArrowBack />
                </span>
                <span className={styles.root.nav.link.label()}>Previous</span>
              </HStack>
              <span className={styles.root.nav.link.title()}>{prev.title}</span>
            </VStack>
          </Link>
        )}
        {next?.url && (
          <Link href={next.url} className={styles.root.nav.link('right')}>
            <VStack gap={4}>
              <HStack gap={8} justify="right">
                <span className={styles.root.nav.link.label()}>Next</span>
                <span className={styles.root.nav.link.icon()}>
                  <IcRoundArrowForward />
                </span>
              </HStack>
              <span className={styles.root.nav.link.title()}>{next.title}</span>
            </VStack>
          </Link>
        )}
      </HStack>
    </LayoutWithSidebar>
  )
}
