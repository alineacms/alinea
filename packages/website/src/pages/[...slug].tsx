import {PageView} from '../view/PageView'

export function getStaticPaths() {
  return {
    fallback: 'blocking',
    paths: []
  }
}

export {getStaticProps} from '.'

export default PageView
