import {Expr, ExprData} from './Expr.js'

export interface Page {
  id: string
}

export namespace Page {
  export const id = Expr(ExprData.Field({}, 'id'))
}
