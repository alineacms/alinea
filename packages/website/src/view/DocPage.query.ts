import {Collection, Store} from '@alinea/store'
import {Doc, Page, Pages} from '../../.alinea/web'
import {blocksQuery} from './blocks/Blocks.query'

function menuQuery() {
  return Page.where(Page.type.is('Doc').or(Page.type.is('Docs')))
    .where(Page.id.isNot('docs'))
    .select({
      id: Page.id,
      type: Page.type,
      url: Page.url,
      title: Page.title,
      parent: Page.parent
    })
    .orderBy(Page.index.asc())
}

export function docPageQuery(pages: Pages, doc: Collection<Doc>) {
  const siblings = Doc.where(Doc.parent.is(doc.parent)).select({
    url: Doc.url,
    title: Doc.title
  })
  const prev = siblings
    .orderBy(Doc.index.desc())
    .where(Doc.index.less(doc.index))
    .first()
  const next = siblings
    .orderBy(Doc.index.asc())
    .where(Doc.index.greater(doc.index))
    .first()
  return doc.fields.with({
    menu: menuQuery(),
    prev,
    next,
    blocks: blocksQuery(pages, doc.blocks)
  })
}

export type DocPageProps = Store.TypeOf<ReturnType<typeof docPageQuery>>
