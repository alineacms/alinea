import {Page} from '../../.alinea/web'
import {backend} from '../../alinea.backend'
import {PageView} from '../view/PageView'

export async function getStaticPaths() {
  const pages = backend.loadPages('web')
  const urls = await pages.find(Page.type.isIn(['Doc'])).select(Page.url)
  return {
    fallback: 'blocking',
    paths: urls.map(url => ({params: {slug: url.split('/').slice(1)}}))
  }
}

export {getStaticProps} from '.'

export default PageView
