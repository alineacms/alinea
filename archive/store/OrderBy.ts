import {ExprData} from './Expr.js'

export const enum OrderDirection {
  Asc,
  Desc
}

export type OrderBy = {
  expr: ExprData
  order: OrderDirection
}
