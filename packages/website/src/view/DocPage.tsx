import {HStack, px, Stack, Typo} from '@alinea/ui'
import Link from 'next/link'
import {MdArrowBack, MdArrowForward} from 'react-icons/md/index.js'
import {Blocks} from './blocks/Blocks'
import {DocPageProps} from './DocPage.query'
import {Container} from './layout/Container'

export function DocPage({title, blocks, menu, next, prev}: DocPageProps) {
  return (
    <Container>
      <Blocks blocks={blocks} />
      <HStack center gap={20} style={{paddingTop: px(30)}}>
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
                <HStack gap={8}>
                  <span>{next.title}</span>
                  <MdArrowForward />
                </HStack>
              </Typo.Link>
            </Link>
          )}
        </Stack.Right>
      </HStack>
    </Container>
  )
}
