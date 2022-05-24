import {content} from '@alinea/content/web'
import {Store} from '@alinea/store'
import {docPageQuery} from './DocPage.query'
import {layoutQuery} from './layout/Layout.query'

async function loadPage(pages: content.Pages, page: content.AnyPage) {
  switch (page.type) {
    case 'Doc':
      return docPageQuery(pages, page)
    default:
      return page
  }
}

export async function pageViewQuery(pages: content.Pages, url: string) {
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
