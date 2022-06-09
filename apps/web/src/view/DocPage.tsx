import {fromModule, HStack, Stack, TextLabel, Typo} from '@alinea/ui'
import {IcRoundArrowBack} from '@alinea/ui/icons/IcRoundArrowBack'
import {IcRoundArrowForward} from '@alinea/ui/icons/IcRoundArrowForward'
import Link from 'next/link'
import {Blocks} from './blocks/Blocks'
import css from './DocPage.module.scss'
import {DocPageProps} from './DocPage.server'
import {Container} from './layout/Container'
import {Layout} from './layout/Layout'
import {NavSidebar} from './layout/NavSidebar'
import {NavTree, useNavTree} from './layout/NavTree'
import {WebTypo} from './layout/WebTypo'

const styles = fromModule(css)

export function DocPage({title, blocks, menu, next, prev}: DocPageProps) {
  const nav = useNavTree(menu)
  return (
    <Layout.Content>
      <Container>
        <HStack gap={80}>
          <NavSidebar>
            <NavTree nav={nav} />
          </NavSidebar>
          <div style={{flexGrow: 1, minWidth: 0}}>
            <Blocks blocks={blocks} />
            <HStack center gap={20} className={styles.root.nav()}>
              {prev && (
                <Link href={prev.url} passHref>
                  <WebTypo.Link>
                    <HStack gap={8}>
                      <IcRoundArrowBack />
                      <span>
                        <TextLabel label={prev.title} />
                      </span>
                    </HStack>
                  </WebTypo.Link>
                </Link>
              )}
              <Stack.Right>
                {next && (
                  <Link href={next.url} passHref>
                    <Typo.Link>
                      <HStack center gap={8}>
                        <span>
                          <TextLabel label={next.title} />
                        </span>
                        <IcRoundArrowForward />
                      </HStack>
                    </Typo.Link>
                  </Link>
                )}
              </Stack.Right>
            </HStack>
          </div>
        </HStack>
      </Container>
    </Layout.Content>
  )
}
