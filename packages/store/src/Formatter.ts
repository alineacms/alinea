import {CursorData} from './Cursor'
import {BinOp, ExprData, UnOp} from './Expr'
import {From} from './From'
import {OrderBy} from './OrderBy'
import {Param} from './Param'
import {SelectionData} from './Selection'
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

export type FormatCursorOptions = {
  includeSelection?: boolean
  formatSubject?: (selection: Statement) => Statement
}

export type FormatExprOptions = FormatCursorOptions & {
  formatInline?: boolean
  formatAsJsonValue?: boolean
  formatShallow?: boolean
}

export abstract class Formatter {
  constructor() {}

  abstract escape(value: any): string
  abstract escapeId(id: string): string
  abstract formatAccess(on: Statement, field: string): Statement
  abstract formatField(path: Array<string>, shallow: boolean): Statement
  abstract formatUnwrapArray(sql: Statement): Statement

  formatFrom(from: From, options: FormatExprOptions): Statement {
    switch (from.type) {
      case 'table':
        return Statement.raw(
          from.alias
            ? `${this.escapeId(from.name)} as ${this.escapeId(from.alias)}`
            : this.escapeId(from.name)
        )
      case 'column':
        return this.formatFrom(from.of, options)
      case 'join':
        const left = this.formatFrom(from.left, options)
        const right = this.formatFrom(from.right, options)
        const on = this.formatExpr(from.on, options)
        const join = from.join === 'left' ? 'left' : 'inner'
        return sql`${left} ${Statement.raw(join)} join ${right} on ${on}`
    }
  }

  formatOrderBy(
    orderBy: Array<OrderBy> | undefined,
    options: FormatExprOptions
  ): Statement {
    if (!orderBy || orderBy.length == 0) return Statement.EMPTY
    const orders = []
    const params = []
    for (const {expr, order} of orderBy) {
      const stmt = this.formatExpr(expr, options)
      orders.push(`${stmt.sql} ${order === 'asc' ? 'asc' : 'desc'}`)
      params.push(...stmt.params)
    }
    return new Statement(`order by ${orders.join(', ')}`, params)
  }

  formatWhere(
    where: ExprData | undefined,
    options: FormatExprOptions
  ): Statement {
    return where
      ? sql`where ${this.formatExpr(where, options)}`
      : Statement.EMPTY
  }

  formatSelection(
    selection: SelectionData,
    options: FormatExprOptions
  ): Statement {
    switch (selection.type) {
      case 'row':
        const {source} = selection
        switch (source.type) {
          case 'column':
            return Statement.raw(
              `json(${this.escapeId(From.source(source))}.${this.escapeId(
                source.column
              )})`
            )
          case 'table':
            return this.formatSelection(
              SelectionData.Fields(
                Object.fromEntries(
                  source.columns.map(column => [
                    column,
                    SelectionData.Expr(
                      ExprData.Field([source.alias || source.name, column])
                    )
                  ])
                )
              ),
              options
            )
          case 'join':
            throw 'assert'
        }
      case 'cursor':
        const sub = this.formatCursor(selection.cursor, {
          ...options,
          formatSubject: subject => sql`${subject} as res`
        })
        if (selection.cursor.singleResult) return sql`(select ${sub})`
        return sql`(select json_group_array(json(res)) from (select ${sub}))`
      case 'expr':
        return this.formatExpr(selection.expr, options)
      case 'with':
        const a = this.formatSelection(selection.a, options)
        const b = this.formatSelection(selection.b, options)
        return sql`json_patch(${a}, ${b})`
      case 'fields':
        let res = Statement.EMPTY
        const keys = Object.keys(selection.fields)
        Object.entries(selection.fields).forEach(([key, value], i) => {
          res = sql`${res}${Statement.raw(
            this.escape(key)
          )}, ${this.formatSelection(value, options)}`
          if (i < keys.length - 1) res = sql`${res}, `
        })
        return sql`json_object(${res})`
    }
  }

  formatCursor(cursor: CursorData, options: FormatCursorOptions): Statement {
    const subject = this.formatSelection(cursor.selection, options)
    const select = options.includeSelection
      ? options.formatSubject
        ? options.formatSubject(subject)
        : subject
      : undefined
    const from = sql`from ${this.formatFrom(cursor.from, options)}`
    const where = this.formatWhere(cursor.where, options)
    const limit =
      cursor.limit !== undefined || cursor.offset !== undefined
        ? sql`limit ${Param.value(cursor.limit || 0)}`
        : undefined
    const offset =
      cursor.offset !== undefined
        ? sql`offset ${Param.value(cursor.offset)}`
        : undefined
    const order = this.formatOrderBy(cursor.orderBy, options)
    return sql`${select} ${from} ${where} ${order} ${limit} ${offset}`
  }

  formatExpr(expr: ExprData, options: FormatExprOptions): Statement {
    switch (expr.type) {
      case 'unop':
        if (expr.op === UnOp.IsNull)
          return sql`${this.formatExpr(expr.expr, options)} is null`
        return sql`!(${this.formatExpr(expr.expr, options)})`
      case 'binop':
        if (expr.op === BinOp.In || expr.op === BinOp.NotIn) {
          return sql`(${this.formatExpr(expr.a, options)} ${Statement.raw(
            binOps[expr.op]
          )} ${this.formatUnwrapArray(this.formatExpr(expr.b, options))})`
        }
        return sql`(${this.formatExpr(expr.a, options)} ${Statement.raw(
          binOps[expr.op]
        )} ${this.formatExpr(expr.b, options)})`
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
                const res = sql`(${Statement.raw(
                  value.map((v: any): string => this.escape(v)).join(', ')
                )})`
                return options.formatAsJsonValue ? sql`json_array${res}` : res
              case typeof value === 'string' || typeof value === 'number':
                if (options.formatInline)
                  return Statement.raw(this.escape(value))
                return new Statement('?', [expr.param])
              default:
                return new Statement(this.escape(value))
            }
        }
      case 'field':
        return this.formatField(expr.path, Boolean(options.formatShallow))
      case 'call': {
        const params = expr.params.map(e => this.formatExpr(e, options))
        const expressions = params.map(stmt => stmt.sql).join(', ')
        return new Statement(
          `${this.escapeId(expr.method)}(${expressions})`,
          params.flatMap(stmt => stmt.params)
        )
      }
      case 'access':
        return this.formatAccess(
          this.formatExpr(expr.expr, options),
          expr.field
        )
      case 'query':
        return sql`(select ${this.formatCursor(expr.cursor, options)})`
    }
  }

  formatSelect(cursor: CursorData, options: FormatCursorOptions = {}) {
    return sql`select ${this.formatCursor(cursor, {
      ...options,
      includeSelection: true
    })}`
  }

  formatDelete(cursor: CursorData, options: FormatCursorOptions = {}) {
    return sql`delete ${this.formatCursor(cursor, {
      ...options,
      includeSelection: false
    })}`
  }

  // Todo: make abstract
  formatUpdateSetters(
    update: Record<string, any>,
    options: FormatExprOptions
  ): Statement {
    let source = new Statement('`data`')
    for (const [key, value] of Object.entries(update)) {
      const expr = this.formatExpr(ExprData.create(value), {
        ...options,
        formatAsJsonValue: true
      })
      source = sql`json_set(${source}, ${Statement.raw(
        this.escape(`$.${key}`)
      )}, ${expr})`
    }
    return sql`set \`data\` = ${source}`
  }

  formatUpdate(
    cursor: CursorData,
    update: Record<string, any>,
    options: FormatCursorOptions = {}
  ) {
    const from = this.formatFrom(cursor.from, options)
    const set = this.formatUpdateSetters(update, options)
    const where = this.formatWhere(cursor.where, options)
    return sql`update ${from} ${set} ${where}`
  }
}
