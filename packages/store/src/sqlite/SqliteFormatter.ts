import {ExprData} from '../Expr'
import {FormatExprOptions, Formatter} from '../Formatter'
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
  formatAccess(on: Statement, field: string): Statement {
    const target = Statement.raw(this.escapeString(`$.${field}`))
    return sql`json_extract(${on}, ${target})`
  }
  formatField(path: Array<string>, shallow = false): Statement {
    switch (path.length) {
      case 0:
        throw 'assert'
      case 1:
        return Statement.raw(this.escapeId(path[0]))
      default:
        const from = Statement.raw(
          (shallow ? [path[1]] : [path[0], path[1]])
            .map(this.escapeId)
            .join('.')
        )
        if (path.length == 2) return from
        const target = Statement.raw(
          this.escapeString(`$.${path.slice(2).join('.')}`)
        )
        return sql`json_extract(${from}, ${target})`
    }
  }
  formatUnwrapArray(stmt: Statement): Statement {
    return sql`(select value from json_each(${stmt}))`
  }
  formatExpr(expr: ExprData, options: FormatExprOptions): Statement {
    switch (expr.type) {
      case 'call':
        if (expr.method === 'cast') {
          const [e, type] = expr.params
          const typeName =
            type.type === 'param' &&
            type.param.type === 'value' &&
            type.param.value
          if (!typeName) throw 'assert'
          return sql`cast(${this.formatExpr(
            expr.params[0],
            options
          )} as ${Statement.raw(this.escapeString(typeName))})`
        }
    }
    return super.formatExpr(expr, options)
  }
})()
