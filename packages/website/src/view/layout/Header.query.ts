import {Entry} from '@alinea/core'
import {Store} from '@alinea/store'
import {Home} from '../../../.alinea/web'

export function headerQuery() {
  const links = Home.links.each()
  const Link = Entry.as('Link')
  return Home.select({
    links: links
      .where(links.type.is('entry'))
      .innerJoin(Link, Link.id.is(links.entry))
      .select({id: Link.id, title: links.title, url: Link.url})
  }).first()
}

export type HeaderProps = Store.TypeOf<ReturnType<typeof headerQuery>>
