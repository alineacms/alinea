declare const brand: unique symbol
export class Expr<Value = unknown> {
  [brand]!: Value

  constructor() {}
}
