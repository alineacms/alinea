import {Page, Pages} from 'alinea/content'
import {Store} from 'alinea/store'

export async function blogOverviewQuery(
  pages: Pages,
  overview: Page.BlogOverview
) {
  return {
    ...overview,
    posts: await pages.tree(overview.id).children().whereType('BlogPost')
  }
}

export type BlogOverviewProps = Store.TypeOf<
  ReturnType<typeof blogOverviewQuery>
>
