import {CursorData} from './Cursor'
import {BinOp, ExprData, UnOp} from './Expr'
import {sql, Statement} from './Statement'

const binOps = {
  [BinOp.Add]: '+',
  [BinOp.Subt]: '-',
  [BinOp.Mult]: '*',
  [BinOp.Mod]: '%',
  [BinOp.Div]: '/',
  [BinOp.Greater]: '>',
  [BinOp.GreaterOrEqual]: '>=',
  [BinOp.Less]: '<',
  [BinOp.LessOrEqual]: '<=',
  [BinOp.Equals]: '=',
  [BinOp.NotEquals]: '!=',
  [BinOp.And]: 'and',
  [BinOp.Or]: 'or',
  [BinOp.Like]: 'like',
  [BinOp.Glob]: 'glob',
  [BinOp.Match]: 'match',
  [BinOp.In]: 'in',
  [BinOp.NotIn]: 'not in',
  [BinOp.Concat]: '||'
}

type FormatterOptions = {
  formatAsJsonValue?: boolean
}

export abstract class Formatter {
  constructor(private options: FormatterOptions = {}) {}

  abstract formatCursor(cursor: CursorData): Statement

  emitExpr(expr: ExprData): Statement {
    const {emitExpr} = this
    switch (expr.type) {
      case 'unop':
        if (expr.op === UnOp.IsNull) return sql`${emitExpr(expr.expr)} is null`
        return sql`!(${emitExpr(expr.expr)})`
      case 'binop':
        if (expr.op === BinOp.In || expr.op === BinOp.NotIn) {
          return sql`${emitExpr(expr.a)} ${
            binOps[expr.op]
          } ${this.formatUnwrapArray(emitExpr(expr.b))}`
        }
        return sql`${emitExpr(expr.a)} ${binOps[expr.op]} ${emitExpr(
          expr.b,
          ctx
        )}`
      case 'param':
        switch (expr.param.type) {
          case 'named':
            return new Statement('?', [expr.param])
          case 'value':
            const value = expr.param.value
            switch (true) {
              case value === null:
                return sql`null`
              case typeof value === 'boolean':
                return value ? sql`1` : sql`0`
              case Array.isArray(value):
                const res = sql`(${value.map(this.escape).join(', ')})`
                return this.formatAsJsonValue ? sql`json_array(${res})` : res
              default:
                if (this.formatInline) return sql`${this.escape(value)}`
                return new Statement('?', [expr.param])
            }
        }
      case 'field':
        return this.formatField(expr.path)
      case 'call': {
        const params = expr.params.map(e => emitExpr(e))
        const expressions = params.map(stmt => stmt.sql).join(', ')
        return new Statement(
          `${this.escapeId(expr.method)}(${expressions})`,
          params.flatMap(stmt => stmt.params)
        )
      }
      case 'access': {
        const {sql, params} = emitExpr(expr.expr)
        return new Statement(this.formatAccess(sql, expr.field), params)
      }
      case 'query':
        return sql`(select ${this.formatCursor(expr.cursor)})`
    }
  }
}
