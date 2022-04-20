import {GetStaticPropsContext} from 'next'
import {types} from '../../data/Types'
import {TypePage} from '../../view/TypePage'

export async function getStaticPaths() {
  return {
    fallback: 'blocking',
    paths: types.children!.map(child => {
      return {params: {path: child.name.split('/')}}
    })
  }
}

export function getStaticProps(context: GetStaticPropsContext) {
  const name = (context.params?.path as Array<string>).join('/')
  const children = types.children!.filter(child => child.name === name)
  return {props: {children}}
}

export default TypePage
