import {first, pages} from 'alinea/pages'
import {GetStaticPropsContext} from 'next'
import {PageView} from '../view/PageView'

export function getStaticPaths() {
  return {
    fallback: 'blocking',
    paths: []
  }
}

export function getStaticProps(context: GetStaticPropsContext) {
  const paths = (context.params?.slug as Array<string>) || []
  const slug = '/' + paths.join('/')
  const entry = first(pages.whereUrl(slug))
  return {
    props: {entry}
  }
}

export default PageView
