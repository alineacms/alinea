import {GetStaticPropsContext} from 'next'
import {backend} from '../../.alinea/backend'
import {Page, pages} from '../../.alinea/web'
import {PageView} from '../view/PageView'
import {pageViewQuery} from '../view/PageView.query'

export async function getStaticProps(context: GetStaticPropsContext) {
  const from = context.preview
    ? pages.preview(backend.drafts, context.previewData as string)
    : pages
  const paths = (context.params?.slug as Array<string>) || []
  const slug = '/' + paths.join('/')
  const props = await from.first(pages.byUrl(slug).select(pageViewQuery(Page)))
  if (!props) return {notFound: true}
  return {props}
}

export default PageView
