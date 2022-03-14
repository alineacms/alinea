import {Page, pages} from '../../.alinea/web'
import {PageView} from '../view/PageView'

export async function getStaticPaths() {
  const urls = await pages.all(
    Page.where(Page.type.isIn(['Doc'])).select({url: Page.url})
  )
  return {
    fallback: 'blocking',
    paths: urls.map(({url}) => ({params: {slug: url.split('/').slice(1)}}))
  }
}

export {getStaticProps} from '.'

export default PageView
