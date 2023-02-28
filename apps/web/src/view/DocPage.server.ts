import {Page, Pages} from '@alinea/content'
import {Entry, Label} from 'alinea/core'
import {Cursor, Store} from 'alinea/store'

export function menuQuery(pages: Pages) {
  return pages
    .where(page => page.type.is('Doc').or(page.type.is('Docs')))
    .where(page => page.id.isNot('docs'))
    .orderBy(page => [page.alinea.index.asc()])
    .select(page => ({
      id: page.id,
      type: page.type,
      url: page.url,
      title: page.title,
      parent: page.alinea.parent
    }))
}

export async function docPageQuery(pages: Pages, doc: Page.Doc) {
  type Sibling = {id: string; type: string; url: string; title: Label}
  const sibling = (doc: Cursor<Page>) => ({
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
    const sort = Entry.alinea.index[direction === 1 ? 'asc' : 'desc']()
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
    parents: (await pages
      .tree(doc.id)
      .parents()
      .select(parent => ({
        id: parent.id,
        title: parent.title,
        url: parent.url
      }))) as Array<{id: string; title: string; url: string}>,
    prev,
    next,
    blocks: doc.blocks
  }
}

export type DocPageProps = Store.TypeOf<ReturnType<typeof docPageQuery>>
