import {Page, Pages} from '@alinea/content'

export async function blogOverviewQuery(
  pages: Pages,
  overview: Page.BlogOverview
) {
  return {
    ...overview,
    posts: await pages.tree(overview.id).children().whereType('BlogPost')
  }
}

export type BlogOverviewProps = Awaited<ReturnType<typeof blogOverviewQuery>>
