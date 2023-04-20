import {Expr, ExprData} from './Expr.js'

export interface Page {
  id: string
  type: string
  url: string
  title: string
  path: string
}

export namespace Page {
  export const id = Expr(ExprData.Field({}, 'id'))
  export const type = Expr(ExprData.Field({}, 'type'))
  export const url = Expr(ExprData.Field({}, 'url'))
  export const title = Expr(ExprData.Field({}, 'title'))
  export const path = Expr(ExprData.Field({}, 'path'))
}
