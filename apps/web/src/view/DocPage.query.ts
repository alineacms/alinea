import {content} from '@alinea/content/web'
import {Cursor, Store} from '@alinea/store'
import {blocksQuery} from './blocks/Blocks.query'

function menuQuery(pages: content.Pages) {
  return pages
    .where(page => page.type.is('Doc').or(page.type.is('Docs')))
    .where(page => page.id.isNot('docs'))
    .orderBy(page => [page.index.asc()])
    .select(page => ({
      id: page.id,
      type: page.type,
      url: page.url,
      title: page.title,
      parent: page.parent
    }))
}

export async function docPageQuery(pages: content.Pages, doc: content.Doc) {
  type Sibling = {id: string; type: string; url: string; title: string}
  const sibling = (doc: Cursor<content.Doc | content.Docs>) => ({
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
    const sort = content.AnyPage.index[direction === 1 ? 'asc' : 'desc']()
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
