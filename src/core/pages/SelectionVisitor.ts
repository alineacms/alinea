import {Selection} from './Selection.js'

export interface SelectionVisitor<Produces> {
  visit?(selection: Selection): Produces
  visitCursor?(selection: Selection.Cursor): Produces
  visitRecord?(selection: Selection.Record): Produces
  visitRow?(selection: Selection.Row): Produces
  visitExpr?(selection: Selection.Expr): Produces
}
