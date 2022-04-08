import {fromModule, HStack, Stack, Typo} from '@alineacms/ui'
import Link from 'next/link'
import {MdArrowBack, MdArrowForward} from 'react-icons/md/index.js'
import {Blocks} from './blocks/Blocks'
import css from './DocPage.module.scss'
import {DocPageProps} from './DocPage.query'
import {Container} from './layout/Container'
import {NavSidebar} from './layout/NavSidebar'
import {NavTree, useNavTree} from './layout/NavTree'

const styles = fromModule(css)

export function DocPage({title, blocks, menu, next, prev}: DocPageProps) {
  const nav = useNavTree(menu)
  return (
    <Container>
      <HStack gap={80}>
        <NavSidebar>
          <NavTree nav={nav} />
        </NavSidebar>
        <div style={{flexGrow: 1}}>
          <Blocks blocks={blocks} />
          <HStack center gap={20} className={styles.root.nav()}>
            {prev && (
              <Link href={prev.url} passHref>
                <Typo.Link>
                  <HStack gap={8}>
                    <MdArrowBack />
                    <span>{prev.title}</span>
                  </HStack>
                </Typo.Link>
              </Link>
            )}
            <Stack.Right>
              {next && (
                <Link href={next.url} passHref>
                  <Typo.Link>
                    <HStack center gap={8}>
                      <span>{next.title}</span>
                      <MdArrowForward />
                    </HStack>
                  </Typo.Link>
                </Link>
              )}
            </Stack.Right>
          </HStack>
        </div>
      </HStack>
    </Container>
  )
}
