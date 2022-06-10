import {content} from '@alinea/content/web'
import {Store} from '@alinea/store'

type PageDetails = {
  title: string
  url: string
  type: string
}

const fullLayout = new Set(['API', 'Doc'])

export async function layoutQuery(pages: content.Pages, page: PageDetails) {
  const data = await pages.fetchType(content.Home).select(home => ({
    header: {
      links: home.links
    },
    footer: home.footer
  }))
  return {
    meta: {
      title: page.title,
      url: page.url
    },
    is: {home: page.type === 'Home', full: fullLayout.has(page.type)},
    ...data
  }
}

export type LayoutProps = Exclude<
  Store.TypeOf<ReturnType<typeof layoutQuery>>,
  null
>
