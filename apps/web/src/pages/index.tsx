import {backend} from '@alinea/content'
import {GetStaticPropsContext} from 'next'
import {PageView} from '../view/PageView'
import {pageViewQuery} from '../view/PageView.server'

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = backend.loadPages('web', {
    previewToken: context.previewData as string
  })
  const paths = (context.params?.slug as Array<string>) || []
  const slug = '/' + paths.join('/')
  const page = await pageViewQuery(pages, slug)
  if (!page) return {notFound: true}
  return {props: page}
}

export default PageView
