import {Cursor, Store} from '@alinea/store'
import {Doc, Page, Pages} from '../../.alinea/web'
import {blocksQuery} from './blocks/Blocks.query'

function menuQuery(pages: Pages) {
  return pages
    .findMany(Page.type.is('Doc').or(Page.type.is('Docs')))
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

export async function docPageQuery(pages: Pages, doc: Doc) {
  const sibling = (doc: Cursor<Doc>) => ({
    url: doc.url,
    title: doc.title
  })
  const parent = await pages.tree(doc.id).parent()
  const prev =
    (await pages.tree(doc.id).prevSibling().whereType(Doc).select(sibling)) ||
    (await parent?.tree
      .prevSibling()
      ?.children()
      .orderBy(Page.index.desc())
      .whereType(Doc)
      .first()
      .select(sibling))
  const next =
    (await pages.tree(doc.id).nextSibling().whereType(Doc).select(sibling)) ||
    (await parent?.tree
      .nextSibling()
      ?.children()
      .orderBy(Page.index.asc())
      .whereType(Doc)
      .first()
      .select(sibling))
  return {
    ...doc,
    menu: await menuQuery(pages),
    prev,
    next,
    blocks: await blocksQuery(pages, doc.blocks)
  }
}

export type DocPageProps = Store.TypeOf<ReturnType<typeof docPageQuery>>
