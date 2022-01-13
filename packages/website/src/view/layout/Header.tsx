import {HStack, Logo, px, Stack} from '@alinea/ui'
import Link from 'next/link'
import {RiFlashlightFill} from 'react-icons/ri'
import {Container} from './Container'

export function Header() {
  return (
    <header style={{padding: `${px(25)} 0`}}>
      <Container>
        <HStack center gap={10}>
          <Link href="/">
            <a>
              <Logo>
                <RiFlashlightFill />
              </Logo>
            </a>
          </Link>
          <Stack.Right>
            <Link href="/docs">
              <a>Docs</a>
            </Link>
          </Stack.Right>
        </HStack>
      </Container>
    </header>
  )
}
