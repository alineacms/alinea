import type {Expr} from './Expr.js'

export type OrderBy = {asc: Expr<any>} | {desc: Expr<any>}
