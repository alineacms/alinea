import {fromModule, HStack, TextLabel, VStack} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import Link from 'next/link'
import {Blocks} from './blocks/Blocks'
import css from './DocPage.module.scss'
import type {DocPageProps} from './DocPage.server'
import {Breadcrumbs} from './layout/Breadcrumbs'
import {Layout} from './layout/Layout'
import {NavTree, useNavTree} from './layout/NavTree'

const styles = fromModule(css)

export function DocPage({
  blocks,
  menu,
  next,
  prev,
  parents,
  ...doc
}: DocPageProps) {
  const nav = useNavTree(menu)
  return (
    <Layout.WithSidebar sidebar={<NavTree nav={nav} />}>
      <Breadcrumbs parents={parents.concat(doc)} />
      <Blocks blocks={blocks} />
      <HStack gap={20} justify="space-between" className={styles.root.nav()}>
        {prev && (
          <Link href={prev.url} passHref>
            <a className={styles.root.nav.link()}>
              <VStack gap={4}>
                <HStack gap={8}>
                  <span className={styles.root.nav.link.icon()}>
                    <IcRoundArrowBack />
                  </span>
                  <span className={styles.root.nav.link.label()}>Previous</span>
                </HStack>
                <span className={styles.root.nav.link.title()}>
                  <TextLabel label={prev.title} />
                </span>
              </VStack>
            </a>
          </Link>
        )}
        {next && (
          <Link href={next.url} passHref>
            <a className={styles.root.nav.link('right')}>
              <VStack gap={4}>
                <HStack gap={8} justify="right">
                  <span className={styles.root.nav.link.label()}>Next</span>
                  <span className={styles.root.nav.link.icon()}>
                    <IcRoundArrowForward />
                  </span>
                </HStack>
                <span className={styles.root.nav.link.title()}>
                  <TextLabel label={next.title} />
                </span>
              </VStack>
            </a>
          </Link>
        )}
      </HStack>
    </Layout.WithSidebar>
  )
}
