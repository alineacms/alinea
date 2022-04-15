import {Store} from '@alinea/store'
import {Page, Pages} from '../../.alinea/web'
import {docPageQuery} from './DocPage.query'
import {homePageQuery} from './HomePage.query'
import {layoutQuery} from './layout/Layout.query'

async function loadPage(pages: Pages, page: Page) {
  switch (page.type) {
    case 'Home':
      return homePageQuery(pages, page)
    case 'Doc':
      return docPageQuery(pages, page)
    default:
      return page
  }
}

export async function pageViewQuery(pages: Pages, url: string) {
  const page = await pages.whereUrl(url)
  if (!page) return null
  return {
    layout: await layoutQuery(pages, page),
    entry: await loadPage(pages, page)
  }
}

export type PageViewProps = Exclude<
  Store.TypeOf<ReturnType<typeof pageViewQuery>>,
  null
>
