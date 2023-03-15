import {Expr, ExprData} from './Expr.js'

export interface Page {
  id: string
}

export const Page = {
  id: Expr(ExprData.Field({}, 'id'))
}
