import {Expr} from '@alinea/store/Expr'
import {GetStaticPropsContext} from 'next'
import {Page} from '../../.alinea/web'
import {backend} from '../../alinea.backend'
import {PageView} from '../view/PageView'
import {pageViewQuery} from '../view/PageView.query'

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = backend.loadPages('web', context.previewData as string)
  const paths = (context.params?.slug as Array<string>) || []
  const slug = '/' + paths.join('/')
  const page = await pages
    .fetch(({url}) => url.is(slug))
    .select(pageViewQuery(Page))
    .include({id: Expr.value('string')})
  if (!page) return {notFound: true}
  return {props: page}
}

export default PageView
