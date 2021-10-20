import {pages} from '../pages'
import {Home} from '../schema'
import {HomePage} from '../view/HomePage'

export function getStaticProps() {
  return {
    props: pages.sure(Home)
  }
}

export default HomePage
