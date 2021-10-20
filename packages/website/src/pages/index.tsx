import {InferGetStaticPropsType} from 'next'
import {pages} from '../pages'
import {Home} from '../schema'

export function getStaticProps() {
  return {
    props: pages.sure(Home)
  }
}

export default function HomePage(
  home: InferGetStaticPropsType<typeof getStaticProps>
) {
  return <HomePage {...home} />
}
