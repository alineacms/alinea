import {isRecord} from '#/core/util/Objects.js'
import {
  and,
  Builder,
  eq,
  exists,
  gt,
  gte,
  isNull,
  lt,
  lte,
  not,
  or,
  sql,
  type HasSql,
  type Sql
} from 'rado'
import {jsonExpr} from 'rado/core/expr/Json'

export function jsonField(
  target: HasSql,
  segments: Array<string> = []
): HasSql<unknown> {
  return segments.reduce<HasSql<unknown>>(
    (value, segment) =>
      jsonExpr(value as HasSql<Record<string, unknown>>)[segment],
    target
  )
}

function equals(field: HasSql, value: unknown): Sql<boolean> {
  return value === null ? isNull(field) : eq(field, value)
}

export function compileCondition(
  field: HasSql,
  condition: unknown,
  depth = 0
): Sql<boolean> {
  if (condition === undefined) return sql.value(true)
  if (!isRecord(condition)) return equals(field, condition)
  const clauses: Array<Sql<boolean>> = []
  for (const [operator, value] of Object.entries(condition)) {
    if (value === undefined) continue
    switch (operator) {
      case 'is':
        clauses.push(equals(field, value))
        break
      case 'isNot':
        clauses.push(not(equals(field, value)))
        break
      case 'in':
      case 'notIn': {
        if (!Array.isArray(value))
          throw new Error(`${operator} requires an array`)
        const matches = value.length
          ? or(...value.map(item => equals(field, item)))
          : sql.value(false)
        clauses.push(operator === 'in' ? matches : not(matches))
        break
      }
      case 'gt':
        clauses.push(gt(field, value))
        break
      case 'gte':
        clauses.push(gte(field, value))
        break
      case 'lt':
        clauses.push(lt(field, value))
        break
      case 'lte':
        clauses.push(lte(field, value))
        break
      case 'or': {
        const values = Array.isArray(value) ? value : [value]
        clauses.push(
          values.length
            ? or(...values.map(item => compileCondition(field, item, depth)))
            : sql.value(false)
        )
        break
      }
      case 'has':
        clauses.push(
          compileFilter(value, name => jsonField(field, [name]), depth)
        )
        break
      case 'includes':
        clauses.push(
          arrayIncludes(
            field,
            item =>
              isRecord(value)
                ? compileFilter(
                    value,
                    name => jsonField(item, [name]),
                    depth + 1
                  )
                : equals(item, value),
            depth
          )
        )
        break
      case 'startsWith': {
        if (typeof value !== 'string')
          throw new Error('startsWith requires a string')
        if (value !== '')
          clauses.push(
            sql<boolean>`substr(${field}, 1, ${[...value].length}) = ${value}`
          )
        break
      }
      default:
        throw new Error(`Unsupported SQL condition: ${operator}`)
    }
  }
  return clauses.length ? and(...clauses) : sql.value(true)
}

export function compileFilter(
  filter: unknown,
  field: (name: string) => HasSql,
  depth = 0
): Sql<boolean> {
  if (!isRecord(filter)) throw new Error('A query filter must be an object')
  const keys = Object.keys(filter)
  if (keys.length === 1 && (keys[0] === 'and' || keys[0] === 'or')) {
    const operator = keys[0]
    const values = filter[operator]
    if (!Array.isArray(values)) throw new Error(`${operator} requires an array`)
    const clauses = values
      .filter(value => value !== undefined)
      .map(value => compileFilter(value, field, depth))
    if (!clauses.length) return sql.value(operator === 'and')
    return operator === 'and' ? and(...clauses) : or(...clauses)
  }
  const clauses = Object.entries(filter)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => compileCondition(field(name), value, depth))
  return clauses.length ? and(...clauses) : sql.value(true)
}

export function arrayIncludes(
  field: HasSql,
  predicate: (item: HasSql) => Sql<boolean>,
  depth = 0
): Sql<boolean> {
  const alias = sql.identifier(`alinea_item_${depth}`)
  const value = sql`${alias}.value`
  return exists(
    new Builder()
      .select(sql.value(1))
      .from(sql`json_each(${field}) as ${alias}`)
      .where(predicate(value))
  )
}
