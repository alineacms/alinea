import {CursorData} from './Cursor'
import {BinOp, ExprData, ExprType, UnOp} from './Expr'
import {From, FromType} from './From'
import {OrderBy, OrderDirection} from './OrderBy'
import {Param, ParamType} from './Param'
import {SelectionData, SelectionType} from './Selection'
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
  formatInline?: boolean
  includeSelection?: boolean
  formatSubject?: (selection: Statement) => Statement
}

export type FormatExprOptions = FormatCursorOptions & {
  formatAsJson?: boolean
  formatShallow?: boolean
}

export abstract class Formatter {
  constructor() {}

  abstract escape(value: any): string
  abstract escapeId(id: string): string
  abstract formatJsonAccess(on: Statement, field: string): Statement
  abstract formatValueAccess(on: Statement, field: string): Statement
  abstract formatUnwrapArray(sql: Statement): Statement

  format(value: any, asJson: boolean | undefined): Statement {
    if (asJson) return sql`json(${this.format(JSON.stringify(value), false)})`
    return new Statement(this.escape(value))
  }

  formatString(input: string) {
    return new Statement(this.escape(String(input)))
  }

  formatId(id: string) {
    return new Statement(this.escapeId(id))
  }

  formatAccess(asJson: boolean | undefined, on: Statement, field: string) {
    return asJson
      ? this.formatJsonAccess(on, field)
      : this.formatValueAccess(on, field)
  }

  tryDirectFieldOf(
    expr: ExprData,
    field: string,
    options: FormatExprOptions
  ): Statement | undefined {
    switch (expr.type) {
      case ExprType.Row:
        const {from} = expr
        switch (from.type) {
          case FromType.Each:
            return this.formatAccess(
              options.formatAsJson,
              sql`${this.formatId(from.alias)}.value`,
              field
            )
          case FromType.Table:
            if (options.formatShallow) return this.formatId(field)
            return sql`${this.formatId(
              from.alias || from.name
            )}.${this.formatId(field)}`
          case FromType.Column:
            const origin = this.formatField(
              ExprData.Row(from.of),
              from.column,
              options
            )
            return this.formatAccess(options.formatAsJson, origin, field)
          case FromType.Join:
            return undefined
        }
      case ExprType.Record:
        return (
          expr.fields[field] &&
          this.formatAccess(
            options.formatAsJson,
            this.formatExpr(expr.fields[field], options),
            field
          )
        )
      case ExprType.Merge:
        return (
          this.tryDirectFieldOf(expr.b, field, options) ||
          this.tryDirectFieldOf(expr.a, field, options)
        )
    }
  }

  formatField(
    expr: ExprData,
    field: string,
    options: FormatExprOptions
  ): Statement {
    return (
      this.tryDirectFieldOf(expr, field, options) ||
      this.formatAccess(
        options.formatAsJson,
        this.formatExpr(expr, options),
        field
      )
    )
  }

  formatFrom(from: From, options: FormatExprOptions): Statement {
    switch (from.type) {
      case FromType.Table:
        return from.alias
          ? sql`${this.formatId(from.name)} as ${this.formatId(from.alias)}`
          : this.formatId(from.name)
      case FromType.Column:
        return this.formatFrom(from.of, options)
      case FromType.Join:
        const left = this.formatFrom(from.left, options)
        const right = this.formatFrom(from.right, options)
        const on = this.formatExpr(from.on, options)
        const join = from.join === 'left' ? 'left' : 'inner'
        return sql`${left} ${Statement.raw(join)} join ${right} on ${on}`
      case FromType.Each:
        throw 'Not supported in current formatter: expr.each()'
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
      orders.push(
        `${stmt.sql} ${order === OrderDirection.Asc ? 'asc' : 'desc'}`
      )
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

  formatGroupBy(
    groupBy: Array<ExprData> | undefined,
    options: FormatExprOptions
  ) {
    if (!groupBy || groupBy.length == 0) return Statement.EMPTY
    const by = groupBy.map(expr => this.formatExpr(expr, options))
    return sql`group by ${Statement.join(by, ', ')}`
  }

  formatHaving(
    having: ExprData | undefined,
    options: FormatExprOptions
  ): Statement {
    return having
      ? sql`having ${this.formatExpr(having, options)}`
      : Statement.EMPTY
  }

  formatSelection(
    selection: SelectionData,
    options: FormatExprOptions
  ): Statement {
    switch (selection.type) {
      case SelectionType.Expr:
        return this.formatExpr(selection.expr, {...options, formatAsJson: true})
      case SelectionType.Process:
        return sql`json_object('$__process', ${this.formatString(
          selection.id
        )}, '$__expr', ${this.formatExpr(selection.expr, options)})`
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
    const groupBy = this.formatGroupBy(cursor.groupBy, options)
    const having = this.formatHaving(cursor.having, options)
    const order = this.formatOrderBy(cursor.orderBy, options)
    const limit =
      cursor.limit !== undefined || cursor.offset !== undefined
        ? sql`limit ${
            options.formatInline
              ? this.format(cursor.limit || 0, false)
              : Param.value(cursor.limit || 0)
          }`
        : undefined
    const offset =
      cursor.offset !== undefined
        ? sql`offset ${
            options.formatInline
              ? this.format(cursor.offset, false)
              : Param.value(cursor.offset)
          }`
        : undefined
    return Statement.join(
      [select, from, where, groupBy, having, order, limit, offset],
      ' '
    )
  }

  formatExpr(expr: ExprData, options: FormatExprOptions): Statement {
    const asValue = {...options, formatAsJson: false}
    switch (expr.type) {
      case ExprType.UnOp:
        if (expr.op === UnOp.IsNull)
          return sql`${this.formatExpr(expr.expr, asValue)} is null`
        return sql`!(${this.formatExpr(expr.expr, asValue)})`
      case ExprType.BinOp:
        if (
          (expr.op === BinOp.In || expr.op === BinOp.NotIn) &&
          expr.b.type === ExprType.Field
        ) {
          return sql`(${this.formatExpr(expr.a, asValue)} ${Statement.raw(
            binOps[expr.op]
          )} ${this.formatUnwrapArray(this.formatExpr(expr.b, asValue))})`
        }
        return sql`(${this.formatExpr(expr.a, asValue)} ${Statement.raw(
          binOps[expr.op]
        )} ${this.formatExpr(expr.b, asValue)})`
      case ExprType.Param:
        switch (expr.param.type) {
          case ParamType.Named:
            return new Statement('?', [expr.param])
          case ParamType.Value:
            const value = expr.param.value
            switch (true) {
              case Array.isArray(value):
                const res = sql`(${Statement.join(
                  value.map((v: any): Statement => this.format(v, false)),
                  ', '
                )})`
                return options.formatAsJson ? sql`json_array${res}` : res
              case typeof value === 'string' || typeof value === 'number':
                if (options.formatInline)
                  return this.format(value, options.formatAsJson)
                return new Statement('?', [expr.param])
              default:
                return this.format(value, options.formatAsJson)
            }
        }
      case ExprType.Field:
        return this.formatField(expr.expr, expr.field, options)
      case ExprType.Call: {
        const params = expr.params.map(e => this.formatExpr(e, asValue))
        const expressions = params.map(stmt => stmt.sql).join(', ')
        return new Statement(
          `${this.escapeId(expr.method)}(${expressions})`,
          params.flatMap(stmt => stmt.params)
        )
      }
      case ExprType.Query:
        if (!options.formatAsJson)
          return sql`(select ${this.formatCursor(expr.cursor, options)})`
        const sub = this.formatCursor(expr.cursor, {
          ...options,
          formatSubject: subject => sql`${subject} as res`
        })
        // Todo: properly test if expr is expected to scalar
        if (expr.cursor.singleResult) {
          if (expr.cursor.selection.type === SelectionType.Expr)
            return sql`(select ${sub})`
          return sql`json((select ${sub}))`
        }
        return sql`(select json_group_array(json(res)) from (select ${sub}))`

      case ExprType.Row:
        switch (expr.from.type) {
          case FromType.Each:
            throw 'Not supported in current formatter: expr.each()'
          case FromType.Column:
            return sql`json(${this.formatId(
              From.source(expr.from)
            )}.${this.formatId(expr.from.column)})`
          case FromType.Table:
            return this.formatExpr(
              ExprData.Record(
                Object.fromEntries(
                  expr.from.columns.map(column => [
                    column,
                    ExprData.Field(ExprData.Row(expr.from), column)
                  ])
                )
              ),
              options
            )
          case FromType.Join:
            throw new Error(`Cannot format select of join "${expr.from}"`)
        }
      case ExprType.Merge:
        const a = this.formatExpr(expr.a, {
          ...options,
          formatAsJson: true
        })
        const b = this.formatExpr(expr.b, {
          ...options,
          formatAsJson: true
        })
        return sql`json_patch(${a}, ${b})`
      case ExprType.Record:
        let res = Statement.EMPTY
        const keys = Object.keys(expr.fields)
        Object.entries(expr.fields).forEach(([key, value], i) => {
          res = sql`${res}${this.formatString(key)}, ${this.formatExpr(value, {
            ...options,
            formatAsJson: true
          })}`
          if (i < keys.length - 1) res = sql`${res}, `
        })
        return sql`json_object(${res})`
      case ExprType.Case:
        throw `Not supported in current formatter: _.case(...)`
    }
  }

  formatSelect(cursor: CursorData, options: FormatCursorOptions = {}) {
    return sql`select ${this.formatCursor(cursor, {
      ...options,
      includeSelection: true,
      formatSubject: subject => sql`json_object('res', ${subject})`
    })}`
  }

  formatDelete(cursor: CursorData, options: FormatCursorOptions = {}) {
    return sql`delete ${this.formatCursor(cursor, {
      ...options,
      includeSelection: false
    })}`
  }

  // Todo: make abstract
  formatUpdateColumn(
    update: Record<string, any>,
    options: FormatExprOptions
  ): Statement {
    let source = new Statement('`data`')
    for (const [key, value] of Object.entries(update)) {
      const expr = this.formatExpr(ExprData.create(value), {
        ...options,
        formatAsJson: true
      })
      source = sql`json_set(${source}, ${this.format(
        `$.${key}`,
        false
      )}, ${expr})`
    }
    return sql`set \`data\` = ${source}`
  }

  formatUpdateTable(
    columns: Array<string>,
    update: Record<string, any>,
    options: FormatExprOptions
  ): Statement {
    const updates = []
    for (const column of columns) {
      if (!(column in update)) continue
      const expr = this.formatExpr(ExprData.create(update[column]), {
        ...options,
        formatAsJson: true
      })
      updates.push(sql`${this.formatId(column)} = ${expr}`)
    }
    return sql`set ${Statement.join(updates, ', ')}`
  }

  formatUpdate(
    cursor: CursorData,
    update: Record<string, any>,
    options: FormatCursorOptions = {}
  ) {
    const from = this.formatFrom(cursor.from, options)
    const set =
      cursor.from.type === FromType.Table
        ? this.formatUpdateTable(cursor.from.columns, update, options)
        : this.formatUpdateColumn(update, options)
    const where = this.formatWhere(cursor.where, options)
    return sql`update ${from} ${set} ${where}`
  }
}
