import {initPages} from 'alinea/content/pages'

export async function getStaticPaths() {
  const pages = initPages()
  const urls = await pages.whereType('Doc').select(page => page.url)
  return {
    fallback: 'blocking',
    paths: urls.map(url => ({params: {slug: url.split('/').slice(1)}}))
  }
}

export {default, getStaticProps} from './index'
