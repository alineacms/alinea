import {Type} from './Type.js'
import {Lazy} from './util/Lazy.js'

export const EXPR_KEY = '@alinea.Expr'

export interface ExprAddress {
  type?: Type
  name: string
}

export class Expr<Value = unknown> {
  private declare exprBrand: [Value]

  #address: Lazy<ExprAddress>
  constructor(path: Lazy<ExprAddress>) {
    this.#address = path
  }

  toJSON() {
    return {[EXPR_KEY]: Lazy.get(this.#address)}
  }
}
