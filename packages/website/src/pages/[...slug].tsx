import {Entry} from '@alinea/core/Entry'
import {GetStaticPropsContext} from 'next'
import {pages} from '../pages'
import {PageView} from '../view/PageView'

export function getStaticPaths() {
  return {
    fallback: 'blocking',
    paths: []
  }
}

export function getStaticProps(context: GetStaticPropsContext) {
  const paths = context.params!.slug as Array<string>
  const slug = '/' + paths.join('/')
  const entry = pages.first(Entry.where(Entry.$path.is(slug)))
  return {
    props: {entry}
  }
}

export default PageView
