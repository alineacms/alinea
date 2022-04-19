import {Cursor, Store} from '@alinea/store'
import {Doc, Docs, Page, Pages} from '../../.alinea/web'
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
  type Sibling = {id: string; type: string; url: string; title: string}
  const sibling = (doc: Cursor<Doc | Docs>) => ({
    id: doc.id,
    url: doc.url,
    title: doc.title,
    type: doc.type
  })
  async function advance(
    from: string,
    direction: 1 | -1
  ): Promise<Sibling | null> {
    const method = direction === 1 ? 'nextSibling' : 'prevSibling'
    const sort = Page.index[direction === 1 ? 'asc' : 'desc']()
    const fromTree = pages.tree(from)
    async function pickNext(next: Sibling | null): Promise<Sibling | null> {
      switch (next?.type) {
        case 'Doc':
          return next
        case 'Docs':
          return pickNext(
            await pages
              .tree(next.id)
              .children()
              .orderBy(sort)
              .select(sibling)
              .first()
          )
        default:
          const parent = await fromTree.parent()
          return parent && (await advance(parent.id, direction))
      }
    }
    return pickNext(await fromTree[method]().select(sibling))
  }
  const prev = await advance(doc.id, -1)
  const next = await advance(doc.id, 1)
  return {
    ...doc,
    menu: await menuQuery(pages),
    prev,
    next,
    blocks: await blocksQuery(pages, doc.blocks)
  }
}

export type DocPageProps = Store.TypeOf<ReturnType<typeof docPageQuery>>
