import {ExprData} from './Expr'

export enum OrderDirection {
  Asc = 'asc',
  Desc = 'desc'
}

export type OrderBy = {
  expr: ExprData
  order: OrderDirection
}
