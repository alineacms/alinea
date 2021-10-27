import {first, pages} from 'alinea/pages'
import {GetStaticPropsContext} from 'next'
import {PageView} from 'src/view/PageView'

export function getStaticProps(context: GetStaticPropsContext) {
  const paths = (context.params?.slug as Array<string>) || []
  const slug = '/' + paths.join('/')
  const entry = first(pages.whereUrl(slug))
  return {
    props: {entry}
  }
}

export default PageView
