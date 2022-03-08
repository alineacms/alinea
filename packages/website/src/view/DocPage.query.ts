import {Doc} from '.alinea/web'
import {Collection, Expr, Store} from '@alinea/store'

function docPagesMenuQuery() {
  return {todo: Expr.value(0)}
}

export function docPageQuery(Doc: Collection<Doc>) {
  return Doc.fields.with({
    menu: docPagesMenuQuery()
  })
}

export type DocPageProps = Store.TypeOf<ReturnType<typeof docPageQuery>>
