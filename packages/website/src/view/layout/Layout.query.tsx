import {Store} from '@alinea/store'
import {headerQuery} from './Header.query'

export function layoutQuery() {
  return {
    header: headerQuery()
  }
}

export type LayoutProps = Store.TypeOf<ReturnType<typeof layoutQuery>>
