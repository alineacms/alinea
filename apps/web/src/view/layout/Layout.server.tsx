import {content} from '@alinea/content/web'
import {Store} from '@alinea/store'
import {headerQuery} from './Header.server'

type PageDetails = {
  title: string
  url: string
  type: string
}

const fullLayout = new Set(['API', 'Doc'])

export async function layoutQuery(pages: content.Pages, page: PageDetails) {
  return {
    meta: {
      title: page.title,
      url: page.url
    },
    is: {home: page.type === 'Home', full: fullLayout.has(page.type)},
    header: (await headerQuery(pages))!
  }
}

export type LayoutProps = Exclude<
  Store.TypeOf<ReturnType<typeof layoutQuery>>,
  null
>
