import {Entry} from '@alinea/core'
import {Store} from '@alinea/store'
import {Home, Pages} from '../../../.alinea/web'

export async function headerQuery(pages: Pages) {
  return pages
    .whereType(Home)
    .first()
    .select(home => {
      const links = home.links.each()
      const Link = Entry.as('Link')
      return {
        links: links
          .where(links.type.is('entry'))
          .innerJoin(Link, Link.id.is(links.entry))
          .select({id: Link.id, title: links.title, url: Link.url})
      }
    })
}

export type HeaderProps = Exclude<
  Store.TypeOf<ReturnType<typeof headerQuery>>,
  null
>
