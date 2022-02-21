import {Cursor, CursorData} from './Cursor'
import {OrderBy, OrderDirection} from './OrderBy'
import {ParamData, ParamType} from './Param'

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

export enum ExprType {
  UnOp,
  BinOp,
  Field,
  Param,
  Call,
  Access,
  Query
}

export type ExprData =
  | {type: ExprType.UnOp; op: UnOp; expr: ExprData}
  | {type: ExprType.BinOp; op: BinOp; a: ExprData; b: ExprData}
  | {type: ExprType.Field; path: Array<string>}
  | {type: ExprType.Param; param: ParamData}
  | {type: ExprType.Call; method: string; params: Array<ExprData>}
  | {type: ExprType.Access; expr: ExprData; field: string}
  | {type: ExprType.Query; cursor: CursorData}

export const ExprData = {
  UnOp(op: UnOp, expr: ExprData): ExprData {
    return {type: ExprType.UnOp, op: op, expr: expr}
  },
  BinOp(op: BinOp, a: ExprData, b: ExprData): ExprData {
    return {type: ExprType.BinOp, op: op, a: a, b: b}
  },
  Field(path: Array<string>): ExprData {
    return {type: ExprType.Field, path: path}
  },
  Param(param: ParamData): ExprData {
    return {type: ExprType.Param, param: param}
  },
  Call(method: string, params: Array<ExprData>): ExprData {
    return {type: ExprType.Call, method: method, params: params}
  },
  Access(expr: ExprData, field: string): ExprData {
    return {type: ExprType.Access, expr: expr, field: field}
  },
  Query(cursor: CursorData): ExprData {
    return {type: ExprType.Query, cursor: cursor}
  },
  create(input: any) {
    if (input == null) return ExprData.Param(ParamData.Value(null))
    if (input instanceof Expr) return input.expr
    if (input instanceof Cursor) return ExprData.Query(input.cursor)
    return ExprData.Param(ParamData.Value(input))
  }
}

const toExpr = ExprData.create

/** Expression or value of type T */
export type EV<T> = Expr<T> | T

function isConstant<T>(e: ExprData, value: T): boolean {
  switch (e.type) {
    case ExprType.Param:
      switch (e.param.type) {
        case ParamType.Value:
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

  static value<T>(value: T): Expr<T> {
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
  add(this: Expr<number>, that: EV<number>): Expr<number> {
    return new Expr(ExprData.BinOp(BinOp.Add, this.expr, toExpr(that)))
  }
  substract(this: Expr<number>, that: EV<number>): Expr<number> {
    return new Expr(ExprData.BinOp(BinOp.Subt, this.expr, toExpr(that)))
  }
  multiply(this: Expr<number>, that: EV<number>): Expr<number> {
    return new Expr(ExprData.BinOp(BinOp.Mult, this.expr, toExpr(that)))
  }
  remainder(this: Expr<number>, that: EV<number>): Expr<number> {
    return new Expr(ExprData.BinOp(BinOp.Mod, this.expr, toExpr(that)))
  }
  divide(this: Expr<number>, that: EV<number>): Expr<number> {
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
  concat(this: Expr<string>, that: EV<string>): Expr<string> {
    return new Expr(ExprData.BinOp(BinOp.Concat, this.expr, toExpr(that)))
  }
  like(this: Expr<string>, that: EV<string>): Expr<boolean> {
    return new Expr(ExprData.BinOp(BinOp.Like, this.expr, toExpr(that)))
  }
  glob(this: Expr<string>, that: EV<string>): Expr<boolean> {
    return new Expr(ExprData.BinOp(BinOp.Glob, this.expr, toExpr(that)))
  }
  match(this: Expr<string>, that: EV<string>): Expr<boolean> {
    return new Expr(ExprData.BinOp(BinOp.Match, this.expr, toExpr(that)))
  }

  get<T>(path: string): Expr<T> {
    switch (this.expr.type) {
      case ExprType.Field:
        return new Expr(ExprData.Field(this.expr.path.concat(path)))
      default:
        return new Expr(ExprData.Access(this.expr, path))
    }
  }
}
