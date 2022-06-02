import {backend} from '@alinea/content/backend.js'
import {TypeOf} from 'alinea'
import {GetStaticPropsContext} from 'next'
import {membersOf, packageName, packagePaths, typeNav} from '../../data/Types'
import {layoutQuery} from '../../view/layout/Layout.server'

export async function getStaticPaths() {
  return {
    fallback: 'blocking',
    paths: packagePaths().map(path => {
      return {params: {path: path.split('/')}}
    })
  }
}

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = backend.loadPages('web')
  const slug = context.params?.path as Array<string> | null
  const selected = slug?.join('/')!
  const title = packageName(selected)
  const props = {
    layout: await layoutQuery(pages, {title: `API - ${title}`, url: '/types'}),
    selected,
    title,
    members: membersOf(selected),
    nav: typeNav()
  }
  return {props}
}

export type TypePageProps = TypeOf<ReturnType<typeof getStaticProps>>['props']

export {TypePage as default} from '../../view/TypePage'

// export const config = {unstable_runtimeJS: false}
