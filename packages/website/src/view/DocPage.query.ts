import {Doc} from '.alinea/web'
import {Collection, Expr, Store} from '@alinea/store'

function docPagesMenuQuery() {
  return {todo: Expr.value(0)}
}

export function docPageQuery(doc: Collection<Doc>) {
  const siblings = Doc.where(Doc.parent.is(doc.parent)).select({
    url: Doc.url,
    title: Doc.title
  })
  const prev = siblings.where(Doc.index.less(doc.index)).first()
  const next = siblings
    .orderBy(Doc.index.asc())
    .where(Doc.index.greater(doc.index))
    .first()
  return doc.fields.with({
    menu: docPagesMenuQuery(),
    prev,
    next
  })
}

export type DocPageProps = Store.TypeOf<ReturnType<typeof docPageQuery>>
