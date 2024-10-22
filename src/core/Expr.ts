declare const brand: unique symbol
const isExpr = Symbol.for('@alinea.Expr')
export class Expr<Value = unknown> {
  declare [brand]: Value;
  [isExpr] = true

  constructor() {}

  static isExpr(value: unknown): value is Expr {
    return Boolean(value && typeof value === 'object' && isExpr in value)
  }
}
