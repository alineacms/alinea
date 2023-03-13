import {Expr} from './Expr.js'

export interface Page {
  id: string
}

export const Page = {
  id: Expr('field', [], 'id')
}
