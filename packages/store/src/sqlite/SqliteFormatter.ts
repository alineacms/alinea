import {ExprData, ExprType} from '../Expr'
import {FormatExprOptions, Formatter} from '../Formatter'
import {From, FromType} from '../From'
import {ParamData, ParamType} from '../Param'
import {SelectionData, SelectionType} from '../Selection'
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
  formatSelection(
    selection: SelectionData,
    options: FormatExprOptions
  ): Statement {
    switch (selection.type) {
      case SelectionType.Row:
        const {source} = selection
        switch (source.type) {
          case FromType.Each:
            return sql`${this.formatId(source.alias)}.value`
        }
        break
      case SelectionType.Case:
        if (Object.keys(selection.cases).length === 0) {
          if (selection.defaultCase)
            return this.formatSelection(selection.defaultCase, options)
          return sql`null`
        }
        let result = sql`case ${this.formatExpr(selection.expr, options)}`
        for (const [when, select] of Object.entries(selection.cases))
          result = sql`${result} when ${this.formatExpr(
            ExprData.Param(ParamData.Value(when)),
            options
          )} then ${this.formatSelection(select, options)}`
        if (selection.defaultCase)
          result = sql`${result} else ${this.formatSelection(
            selection.defaultCase,
            options
          )}`
        return sql`${result} end`
    }
    return super.formatSelection(selection, options)
  }
  formatAccess(on: Statement, field: string): Statement {
    const target = this.formatString(`$.${field}`)
    return sql`json_extract(${on}, ${target})`
  }
  formatField(from: From, field: string, shallow = false): Statement {
    switch (from.type) {
      case FromType.Each: {
        const path = this.formatString(`$.${field}`)
        return sql`json_extract(${this.formatId(from.alias)}.value, ${path})`
      }
      case FromType.Table: {
        if (shallow) return this.formatId(field)
        return sql`${this.formatId(from.alias || from.name)}.${this.formatId(
          field
        )}`
      }
      case FromType.Column: {
        const origin = this.formatField(from.of, from.column, shallow)
        const path = this.formatString(`$.${field}`)
        return sql`json_extract(${origin}, ${path})`
      }
      case FromType.Join: {
        throw 'assert'
      }
    }
  }
  formatUnwrapArray(stmt: Statement): Statement {
    return sql`(select value from json_each(${stmt}))`
  }
  formatExpr(expr: ExprData, options: FormatExprOptions): Statement {
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
              options
            )} as ${this.formatString(typeName)})`
          case 'arrayLength':
            return this.formatExpr(
              ExprData.Call('json_array_length', expr.params),
              options
            )
        }
    }
    return super.formatExpr(expr, options)
  }
})()
