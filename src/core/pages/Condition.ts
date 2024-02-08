import {Expr, HasExpr} from './Expr.js'

export type Condition = Expr<boolean> | HasExpr<boolean>
