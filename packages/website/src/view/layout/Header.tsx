import {HStack, Logo, px, Stack, Typo} from '@alinea/ui'
import Link from 'next/link'
import {RiFlashlightFill} from 'react-icons/ri/index'
import {Container} from './Container'

export function Header() {
  return (
    <header style={{padding: `${px(25)} 0`}}>
      <Container>
        <HStack center gap={10}>
          <Link href="/">
            <Logo>
              <RiFlashlightFill />
            </Logo>
          </Link>
          <Stack.Right>
            <Link href="/docs">
              <Typo.Link>Docs</Typo.Link>
            </Link>
          </Stack.Right>
        </HStack>
      </Container>
    </header>
  )
}
