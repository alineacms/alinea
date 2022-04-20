import {Page} from '../../.alinea/web'
import {backend} from '../../alinea.backend'

export async function getStaticPaths() {
  const pages = backend.loadPages('web')
  const urls = await pages.findMany(Page.type.isIn(['Doc'])).select(Page.url)
  return {
    fallback: 'blocking',
    paths: urls.map(url => ({params: {slug: url.split('/').slice(1)}}))
  }
}

export {default, getStaticProps} from '.'
