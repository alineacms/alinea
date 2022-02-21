import {ExprData} from './Expr'

export enum OrderDirection {
  Asc,
  Desc
}

export type OrderBy = {
  expr: ExprData
  order: OrderDirection
}
