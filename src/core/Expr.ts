import {Lazy} from './util/Lazy.js'

export class Expr<Value> {
  private declare exprBrand: [Value]

  #path: Lazy<Array<string>>
  constructor(path: Lazy<Array<string>>) {
    this.#path = path
  }

  toJSON() {
    return Lazy.get(this.#path)
  }
}
