import {initPages} from '@alinea/content/web/pages.js'

export async function getStaticPaths() {
  const pages = initPages()
  const urls = await pages
    .where(page => page.type.isIn(['Doc']))
    .select(page => page.url)
  return {
    fallback: 'blocking',
    paths: urls.map(url => ({params: {slug: url.split('/').slice(1)}}))
  }
}

export {default, getStaticProps} from './index'
