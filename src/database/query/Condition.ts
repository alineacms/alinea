import {
  parseCondition,
  parseFilter,
  type ConditionNode,
  type FilterNode
} from '#/core/Filter.js'
import {
  and,
  Builder,
  eq,
  exists,
  gt,
  gte,
  inArray,
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

type FieldSql = (name: string) => HasSql

export function jsonField(
  target: HasSql,
  segments: Array<string>
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
  condition: unknown
): Sql<boolean> {
  return conditionSql(field, parseCondition(condition), 0)
}

export function compileFilter(filter: unknown, field: FieldSql): Sql<boolean> {
  return filterSql(parseFilter(filter), field, 0)
}

function filterSql(
  node: FilterNode,
  field: FieldSql,
  depth: number
): Sql<boolean> {
  switch (node.op) {
    case 'and': {
      const clauses = node.nodes.map(node => filterSql(node, field, depth))
      return clauses.length ? and(...clauses) : sql.value(true)
    }
    case 'or': {
      const clauses = node.nodes.map(node => filterSql(node, field, depth))
      return clauses.length ? or(...clauses) : sql.value(false)
    }
    case 'field':
      return conditionSql(field(node.name), node.condition, depth)
  }
}

function conditionSql(
  field: HasSql,
  node: ConditionNode,
  depth: number
): Sql<boolean> {
  switch (node.op) {
    case 'and': {
      const clauses = node.nodes.map(node => conditionSql(field, node, depth))
      return clauses.length ? and(...clauses) : sql.value(true)
    }
    case 'or': {
      const clauses = node.nodes.map(node => conditionSql(field, node, depth))
      return clauses.length ? or(...clauses) : sql.value(false)
    }
    case 'is':
      return equals(field, node.value)
    case 'isNot':
      return not(equals(field, node.value))
    case 'in':
    case 'notIn': {
      const nonNull = node.values.filter(item => item !== null)
      const matches = node.values.length
        ? or(
            node.values.includes(null) ? isNull(field) : undefined,
            nonNull.length ? inArray(field, nonNull) : undefined
          )
        : sql.value(false)
      return node.op === 'in' ? matches : not(matches)
    }
    case 'gt':
      return gt(field, node.value)
    case 'gte':
      return gte(field, node.value)
    case 'lt':
      return lt(field, node.value)
    case 'lte':
      return lte(field, node.value)
    case 'startsWith':
      return sql<boolean>`substr(${field}, 1, ${[...node.value].length}) = ${node.value}`
    case 'has':
      return filterSql(node.filter, name => jsonField(field, [name]), depth)
    case 'includes':
      return arrayIncludes(
        field,
        item => conditionSql(item, node.item, depth + 1),
        depth
      )
  }
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
