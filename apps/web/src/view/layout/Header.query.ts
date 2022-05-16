import {Store} from '@alinea/store'
import {Home, Pages} from '../../../.alinea/web'

export async function headerQuery(pages: Pages) {
  return pages
    .whereType(Home)
    .first()
    .select(home => {
      return {links: home.links}
    })
}

export type HeaderProps = Exclude<
  Store.TypeOf<ReturnType<typeof headerQuery>>,
  null
>
