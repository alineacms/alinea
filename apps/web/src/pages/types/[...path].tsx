import {TypeOf} from 'alinea'
import {GetStaticPropsContext} from 'next'
import {backend} from '../../../alinea.backend'
import {memberPath, types} from '../../data/Types'
import {layoutQuery} from '../../view/layout/Layout.query'

export async function getStaticPaths() {
  return {
    fallback: 'blocking',
    paths: types.children!.map(child => {
      return {params: {path: memberPath(child.name).split('/')}}
    })
  }
}

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = backend.loadPages('web')
  const slug = context.params?.path as Array<string> | null
  const selected = slug?.join('/')
  const props = {
    layout: await layoutQuery(pages, {title: 'Types', url: '/types'}),
    selected
  }
  return {props}
}

export type TypePageProps = TypeOf<ReturnType<typeof getStaticProps>>['props']

export {TypePage as default} from '../../view/TypePage'

export const config = {unstable_runtimeJS: false}
