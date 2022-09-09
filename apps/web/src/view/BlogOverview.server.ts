import {content} from '@alinea/content/web'
import {Store} from '@alinea/store'

export async function blogOverviewQuery(
  pages: content.Pages,
  overview: content.BlogOverview
) {
  return {
    ...overview,
    posts: await pages.tree(overview.id).children().whereType('BlogPost')
  }
}

export type BlogOverviewProps = Store.TypeOf<
  ReturnType<typeof blogOverviewQuery>
>
