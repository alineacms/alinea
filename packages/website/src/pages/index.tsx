import {HStack, Logo, px, Typo, Viewport} from '@alinea/ui'
import {InferGetStaticPropsType} from 'next'
import Link from 'next/link'
import {HTMLAttributes, PropsWithChildren} from 'react'
import {RiFlashlightFill} from 'react-icons/ri/index'
import {pages} from '../pages'
import {Home} from '../schema'

export function getStaticProps() {
  return {
    props: pages.sure(Home)
  }
}

function Container(props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div style={{paddingLeft: px(25), paddingRight: px(25)}} {...props} />
}

export default function HomePage({
  headline
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <Viewport color="#FB934F">
      <Container>
        <header style={{padding: px(25)}}>
          <HStack center gap={10}>
            <Logo>
              <RiFlashlightFill />
            </Logo>
            <Typo.H1 flat>{headline}</Typo.H1>
          </HStack>
        </header>
        <Link href="/admin">
          <a style={{color: 'white'}}>Go to admin panel</a>
        </Link>
      </Container>
    </Viewport>
  )
}
