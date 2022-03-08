import {Home} from '.alinea/web'
import {Collection} from '@alinea/store'

export function homePageQuery(Home: Collection<Home>) {
  return Home.fields
}
