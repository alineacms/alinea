import {Store} from '@alinea/store'
import {Pages} from '../../../.alinea/web'
import {headerQuery} from './Header.query'

type PageDetails = {
  title: string
  url: string
}

export async function layoutQuery(pages: Pages, page: PageDetails) {
  return {
    meta: {
      title: page.title,
      url: page.url
    },
    header: (await headerQuery(pages))!
  }
}

export type LayoutProps = Exclude<
  Store.TypeOf<ReturnType<typeof layoutQuery>>,
  null
>
