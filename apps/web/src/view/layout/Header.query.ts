import {content} from '@alinea/content/web'
import {Store} from '@alinea/store'

export async function headerQuery(pages: content.Pages) {
  return pages.fetchType(content.Home).select(home => ({links: home.links}))
}

export type HeaderProps = Exclude<
  Store.TypeOf<ReturnType<typeof headerQuery>>,
  null
>
