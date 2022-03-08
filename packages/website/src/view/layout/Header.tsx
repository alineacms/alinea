import {HStack, Logo, px, Stack, Typo} from '@alinea/ui'
import Link from 'next/link'
import {RiFlashlightFill} from 'react-icons/ri'
import {Container} from './Container'
import {HeaderProps} from './Header.query'

export function Header({links}: HeaderProps) {
  return (
    <header style={{padding: `${px(25)} 0`}}>
      <Container>
        <HStack center gap={16}>
          <Link href="/">
            <a>
              <Logo>
                <RiFlashlightFill />
              </Logo>
            </a>
          </Link>
          <Stack.Right>
            <HStack center gap={16}>
              {links.map(link => {
                return (
                  <Link key={link.id} href={link.url} passHref>
                    <Typo.Link>{link.title}</Typo.Link>
                  </Link>
                )
              })}
            </HStack>
          </Stack.Right>
        </HStack>
      </Container>
    </header>
  )
}
