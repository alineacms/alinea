import {ExprData, ExprType} from '../Expr'
import {FormatExprOptions, Formatter} from '../Formatter'
import {From, FromType} from '../From'
import {ParamData, ParamType} from '../Param'
import {sql, Statement} from '../Statement'

const SINGLE_QUOTE = "'"
const BACKTICK = '`'

export const sqliteFormatter = new (class extends Formatter {
  escape(value: any): string {
    if (value == null) return 'null'
    if (typeof value === 'boolean') return value ? '1' : '0'
    if (typeof value === 'number') return String(value)
    if (typeof value === 'string') return this.escapeString(value)
    return 'json(' + this.escapeString(JSON.stringify(value)) + ')'
  }
  escapeString(input: string) {
    let buf = SINGLE_QUOTE
    for (const char of input) {
      if (char === SINGLE_QUOTE) buf += SINGLE_QUOTE + SINGLE_QUOTE
      else buf += char
    }
    buf += SINGLE_QUOTE
    return buf
  }
  escapeId(input: string): string {
    let buf = BACKTICK
    for (const char of input) {
      if (char === BACKTICK) buf += BACKTICK + BACKTICK
      else buf += char
    }
    buf += BACKTICK
    return buf
  }
  formatFrom(from: From, options: FormatExprOptions): Statement {
    switch (from.type) {
      case FromType.Each:
        return sql`json_each(${this.formatExpr(
          from.expr,
          options
        )}) as ${this.formatId(from.alias)}`
      default:
        return super.formatFrom(from, options)
    }
  }
  formatValueAccess(on: Statement, field: string): Statement {
    const target = this.formatString(`$.${field}`)
    return sql`${on}->>${target}`
  }
  formatJsonAccess(on: Statement, field: string): Statement {
    const target = this.formatString(`$.${field}`)
    return sql`${on}->${target}`
  }
  formatUnwrapArray(stmt: Statement): Statement {
    return sql`(select value from json_each(${stmt}))`
  }
  formatExpr(expr: ExprData, options: FormatExprOptions): Statement {
    const asValue = {...options, formatAsJson: false, formatSubject: undefined}
    switch (expr.type) {
      case ExprType.Call:
        switch (expr.method) {
          case 'cast':
            const [e, type] = expr.params
            const typeName =
              type.type === ExprType.Param &&
              type.param.type === ParamType.Value &&
              type.param.value
            if (!typeName) throw 'assert'
            return sql`cast(${this.formatExpr(
              expr.params[0],
              asValue
            )} as ${this.formatString(typeName)})`
          case 'arrayLength':
            return this.formatExpr(
              ExprData.Call('json_array_length', expr.params),
              asValue
            )
        }
        break
      case ExprType.Row:
        switch (expr.from.type) {
          case FromType.Each:
            return sql`${this.formatId(expr.from.alias)}.value`
        }
        break
      case ExprType.Case:
        if (Object.keys(expr.cases).length === 0) {
          if (expr.defaultCase)
            return this.formatExpr(expr.defaultCase, asValue)
          return sql`null`
        }
        let result = sql`case ${this.formatExpr(expr.expr, asValue)}`
        for (const [when, select] of Object.entries(expr.cases))
          result = sql`${result} when ${this.formatExpr(
            ExprData.Param(ParamData.Value(when)),
            asValue
          )} then ${this.formatExpr(select, options)}`
        if (expr.defaultCase)
          result = sql`${result} else ${this.formatExpr(
            expr.defaultCase,
            options
          )}`
        return sql`${result} end`
    }
    return super.formatExpr(expr, options)
  }
})()
