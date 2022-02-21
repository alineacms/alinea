import {ExprData} from './Expr'

export const enum OrderDirection {
  Asc,
  Desc
}

export type OrderBy = {
  expr: ExprData
  order: OrderDirection
}
