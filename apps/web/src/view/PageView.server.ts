import {Page, Pages} from '@alinea/content'
import {Store} from '@alinea/store'
import {blogOverviewQuery} from './BlogOverview.server'
import {docPageQuery} from './DocPage.server'
import {layoutQuery} from './layout/Layout.server'

async function loadPage(pages: Pages, page: Page) {
  switch (page.type) {
    case 'Doc':
      return docPageQuery(pages, page)
    case 'BlogOverview':
      return blogOverviewQuery(pages, page)
    default:
      return page
  }
}

export async function pageViewQuery(pages: Pages, url: string) {
  const page = await pages.fetchUrl(url)
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
