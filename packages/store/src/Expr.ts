import {Cursor, CursorData} from './Cursor'
import {OrderBy, OrderDirection} from './OrderBy'
import {ParamData} from './Param'

export enum UnOp {
  Not,
  IsNull
}

export enum BinOp {
  Add,
  Subt,
  Mult,
  Mod,
  Div,
  Greater,
  GreaterOrEqual,
  Less,
  LessOrEqual,
  Equals,
  NotEquals,
  And,
  Or,
  Like,
  Glob,
  Match,
  In,
  NotIn,
  Concat
}

export type ExprData =
  | {type: 'unop'; op: UnOp; expr: ExprData}
  | {type: 'binop'; op: BinOp; a: ExprData; b: ExprData}
  | {type: 'field'; path: Array<string>}
  | {type: 'param'; param: ParamData}
  | {type: 'call'; method: string; params: Array<ExprData>}
  | {type: 'access'; expr: ExprData; field: string}
  | {type: 'query'; cursor: CursorData}

export const ExprData = {
  UnOp(op: UnOp, expr: ExprData): ExprData {
    return {type: 'unop', op: op, expr: expr}
  },
  BinOp(op: BinOp, a: ExprData, b: ExprData): ExprData {
    return {type: 'binop', op: op, a: a, b: b}
  },
  Field(path: Array<string>): ExprData {
    return {type: 'field', path: path}
  },
  Param(param: ParamData): ExprData {
    return {type: 'param', param: param}
  },
  Call(method: string, params: Array<ExprData>): ExprData {
    return {type: 'call', method: method, params: params}
  },
  Access(expr: ExprData, field: string): ExprData {
    return {type: 'access', expr: expr, field: field}
  },
  Query(cursor: CursorData): ExprData {
    return {type: 'query', cursor: cursor}
  }
}

/** Expression or value of type T */
type EV<T> = Expr<T> | T

function toExpr<T>(ev: EV<T> | Cursor<T> | null): ExprData {
  if (ev == null) return ExprData.Param(ParamData.Value(null))
  if (ev instanceof Expr) return ev.expr
  if (ev instanceof Cursor) return ExprData.Query(ev.cursor)
  return ExprData.Param(ParamData.Value(ev))
}

function isConstant<T>(e: ExprData, value: T): boolean {
  switch (e.type) {
    case 'param':
      switch (e.param.type) {
        case 'value':
          return e.param.value == value
        default:
          return false
      }
    default:
      return false
  }
}

export class Expr<T> {
  static NULL = toExpr(null)

  static value<T>(value: T) {
    return new Expr(ExprData.Param(ParamData.Value(value)))
  }

  static field(...path: Array<string>) {
    return new Expr(ExprData.Field(path))
  }

  constructor(public expr: ExprData) {
    return new Proxy(this, {
      get(target: any, key) {
        return key in target ? target[key] : target.get(key)
      }
    })
  }

  asc(): OrderBy {
    return {expr: this.expr, order: OrderDirection.Asc}
  }

  desc(): OrderBy {
    return {expr: this.expr, order: OrderDirection.Desc}
  }

  not(): Expr<boolean> {
    return new Expr(ExprData.UnOp(UnOp.Not, this.expr))
  }

  or(this: Expr<boolean>, that: EV<boolean>): Expr<boolean> {
    const a = this.expr
    const b = toExpr(that)
    if (isConstant(b, true)) return new Expr(b)
    if (isConstant(a, true)) return this
    if (isConstant(a, false)) return new Expr(b)
    if (isConstant(b, false)) return this
    return new Expr(ExprData.BinOp(BinOp.Or, a, b))
  }

  and(this: Expr<boolean>, that: EV<boolean>): Expr<boolean> {
    const a = this.expr
    const b = toExpr(that)
    if (isConstant(b, true)) return this
    if (isConstant(a, true)) return new Expr(b)
    if (isConstant(a, false)) return this
    if (isConstant(b, false)) return new Expr(b)
    return new Expr(ExprData.BinOp(BinOp.And, a, b))
  }

  is(that: EV<T>): Expr<boolean> {
    if (that === null || (that instanceof Expr && isConstant(that.expr, null)))
      return this.isNull()
    return new Expr(ExprData.BinOp(BinOp.Equals, this.expr, toExpr(that)))
  }

  isNot(that: EV<T>): Expr<boolean> {
    if (that == null || (that instanceof Expr && isConstant(that.expr, null)))
      return this.isNotNull()
    return new Expr(ExprData.BinOp(BinOp.NotEquals, this.expr, toExpr(that)))
  }

  isIn(that: EV<Array<T>> | Cursor<any>): Expr<boolean> {
    return new Expr(ExprData.BinOp(BinOp.In, this.expr, toExpr(that)))
  }

  isNotIn(that: EV<Array<T>> | Cursor<any>): Expr<boolean> {
    return new Expr(ExprData.BinOp(BinOp.NotIn, this.expr, toExpr(that)))
  }
  isNull(): Expr<boolean> {
    return new Expr(ExprData.UnOp(UnOp.IsNull, this.expr))
  }
  isNotNull(): Expr<boolean> {
    return new Expr(
      ExprData.UnOp(UnOp.Not, ExprData.UnOp(UnOp.IsNull, this.expr))
    )
  }
  add<T extends number>(that: EV<T>): Expr<T> {
    return new Expr(ExprData.BinOp(BinOp.Add, this.expr, toExpr(that)))
  }
  substract<T extends number>(that: EV<T>): Expr<T> {
    return new Expr(ExprData.BinOp(BinOp.Subt, this.expr, toExpr(that)))
  }
  multiply<T extends number>(that: EV<T>): Expr<T> {
    return new Expr(ExprData.BinOp(BinOp.Mult, this.expr, toExpr(that)))
  }
  remainder(that: EV<number>): Expr<number> {
    return new Expr(ExprData.BinOp(BinOp.Mod, this.expr, toExpr(that)))
  }
  divide<T extends number>(that: EV<T>): Expr<number> {
    return new Expr(ExprData.BinOp(BinOp.Div, this.expr, toExpr(that)))
  }
  greater(that: EV<any>): Expr<boolean> {
    return new Expr(ExprData.BinOp(BinOp.Greater, this.expr, toExpr(that)))
  }
  greaterOrEqual(that: EV<any>): Expr<boolean> {
    return new Expr(
      ExprData.BinOp(BinOp.GreaterOrEqual, this.expr, toExpr(that))
    )
  }
  less(that: EV<any>): Expr<boolean> {
    return new Expr(ExprData.BinOp(BinOp.Less, this.expr, toExpr(that)))
  }
  lessOrEqual(that: EV<any>): Expr<boolean> {
    return new Expr(ExprData.BinOp(BinOp.LessOrEqual, this.expr, toExpr(that)))
  }
  concat(that: EV<String>): Expr<String> {
    return new Expr(ExprData.BinOp(BinOp.Concat, this.expr, toExpr(that)))
  }
  like(that: EV<String>): Expr<boolean> {
    return new Expr(ExprData.BinOp(BinOp.Like, this.expr, toExpr(that)))
  }
  glob(that: EV<String>): Expr<boolean> {
    return new Expr(ExprData.BinOp(BinOp.Glob, this.expr, toExpr(that)))
  }
  match(that: EV<String>): Expr<boolean> {
    return new Expr(ExprData.BinOp(BinOp.Match, this.expr, toExpr(that)))
  }

  get<T>(path: string): Expr<T> {
    switch (this.expr.type) {
      case 'field':
        return new Expr(ExprData.Field(this.expr.path.concat(path)))
      default:
        return new Expr(ExprData.Access(this.expr, path))
    }
  }

  toJSON() {
    return this.expr
  }
}
