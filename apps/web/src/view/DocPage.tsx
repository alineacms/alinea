import {fromModule, HStack, Stack, TextLabel} from '@alinea/ui'
import {IcRoundArrowBack} from '@alinea/ui/icons/IcRoundArrowBack'
import {IcRoundArrowForward} from '@alinea/ui/icons/IcRoundArrowForward'
import Link from 'next/link'
import {Blocks} from './blocks/Blocks'
import css from './DocPage.module.scss'
import {DocPageProps} from './DocPage.server'
import {Breadcrumbs} from './layout/Breadcrumbs'
import {Layout} from './layout/Layout'
import {NavSidebar} from './layout/NavSidebar'
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
    <Layout.Container>
      <HStack>
        <NavSidebar>
          <NavTree nav={nav} />
        </NavSidebar>
        <Layout.Scrollable>
          <Breadcrumbs parents={parents.concat(doc)} />
          <Blocks blocks={blocks} />
          <HStack center gap={20} className={styles.root.nav()}>
            {prev && (
              <Link href={prev.url} passHref>
                <a className={styles.root.nav.link()}>
                  <HStack gap={8}>
                    <IcRoundArrowBack />
                    <span>
                      <TextLabel label={prev.title} />
                    </span>
                  </HStack>
                </a>
              </Link>
            )}
            <Stack.Right>
              {next && (
                <Link href={next.url} passHref>
                  <a className={styles.root.nav.link()}>
                    <HStack center gap={8}>
                      <span>
                        <TextLabel label={next.title} />
                      </span>
                      <IcRoundArrowForward />
                    </HStack>
                  </a>
                </Link>
              )}
            </Stack.Right>
          </HStack>
        </Layout.Scrollable>
      </HStack>
    </Layout.Container>
  )
}
