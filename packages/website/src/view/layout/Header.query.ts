import {Entry} from '@alinea/core'
import {Store} from '@alinea/store'
import {Home} from '../../../.alinea/web'

export function headerQuery() {
  const links = Home.links.each()
  const Link = Entry.as('Link')
  return Home.select({
    links: links
      .where(links.get('type').is('entry'))
      .innerJoin(Link, Link.id.is(links.get('entry')))
      .select({id: Link.id, title: Link.title, url: Link.url})
  }).first()
}

export type HeaderProps = Store.TypeOf<ReturnType<typeof headerQuery>>
