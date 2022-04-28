import {backend} from '../../alinea.backend'

export async function getStaticPaths() {
  const pages = backend.loadPages('web')
  const urls = await pages
    .findMany(page => page.type.isIn(['Doc']))
    .select(page => page.url)
  return {
    fallback: 'blocking',
    paths: urls.map(url => ({params: {slug: url.split('/').slice(1)}}))
  }
}

export {default, getStaticProps} from '.'
