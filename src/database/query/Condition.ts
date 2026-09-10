import {isRecord} from '#/core/util/Objects.js'
import {
  and,
  Builder,
  eq,
  exists,
  gt,
  gte,
  isNull,
  inArray,
  lt,
  lte,
  not,
  or,
  sql,
  when,
  type HasSql,
  type Sql
} from 'rado'

export interface QueryField {
  value: HasSql<unknown>
  selection?: HasSql<unknown>
  /** JSON type distinguishes missing, null, numbers and booleans. */
  jsonType?: HasSql<string | null>
  equals?(value: unknown): Sql<boolean>
  child(name: string): QueryField
}

/** All SQL paths and user values are parameters, never executable SQL. */
export function jsonField(
  target: HasSql,
  segments: Array<string> = []
): QueryField {
  const path =
    '$' + segments.map(segment => `.${JSON.stringify(segment)}`).join('')
  const value = sql.jsonPath({target: sql`${target}`, segments, asSql: true})
  const selected = sql
    .jsonPath({target: sql`${target}`, segments, asSql: false})
    .forSelection()
    .mapWith({
      mapFromDriverValue(value, specs) {
        if (value === null) return undefined
        return specs.parsesJson ? value : JSON.parse(String(value))
      }
    })
  return {
    value,
    selection: selected,
    jsonType: sql.universal<string | null>({
      sqlite: sql`json_type(${target}, ${path})`,
      postgres: sql`jsonb_typeof(${target}::jsonb #> ${segments}::text[])`,
      mysql: sql`lower(json_type(json_extract(${target}, ${path})))`
    }),
    child(name) {
      return jsonField(target, [...segments, name])
    }
  }
}

export function columnField(value: HasSql): QueryField {
  return {
    value,
    child(name) {
      return jsonField(value, [name])
    }
  }
}

function equals(field: QueryField, value: unknown): Sql<boolean> {
  if (field.equals) return field.equals(value)
  if (!field.jsonType)
    return value === null ? isNull(field.value) : eq(field.value, value)
  if (value === null) return truth(eq(field.jsonType, 'null'))
  const kind = typeof value
  const type =
    kind === 'number'
      ? or(
          eq(field.jsonType, 'integer'),
          eq(field.jsonType, 'real'),
          eq(field.jsonType, 'number'),
          eq(field.jsonType, 'double'),
          eq(field.jsonType, 'decimal')
        )
      : kind === 'boolean'
        ? or(
            eq(field.jsonType, 'boolean'),
            eq(field.jsonType, value ? 'true' : 'false')
          )
        : eq(field.jsonType, kind === 'string' ? 'text' : kind)
  const portableType =
    kind === 'string' ? or(type, eq(field.jsonType, 'string')) : type
  return truth(and(portableType, eq(field.value, value)))
}

function truth(condition: HasSql<boolean>): Sql<boolean> {
  return sql`coalesce(${condition}, false)`
}

export function compileCondition(
  field: QueryField,
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
        clauses.push(not(truth(equals(field, value))))
        break
      case 'in':
      case 'notIn': {
        if (!Array.isArray(value))
          throw new Error(`${operator} requires an array`)
        const matches = value.length
          ? or(...value.map(item => equals(field, item)))
          : sql.value(false)
        clauses.push(operator === 'in' ? matches : not(truth(matches)))
        break
      }
      case 'gt':
        clauses.push(truth(gt(field.value, value)))
        break
      case 'gte':
        clauses.push(truth(gte(field.value, value)))
        break
      case 'lt':
        clauses.push(truth(lt(field.value, value)))
        break
      case 'lte':
        clauses.push(truth(lte(field.value, value)))
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
        clauses.push(compileFilter(value, name => field.child(name), depth))
        break
      case 'includes':
        clauses.push(
          arrayIncludes(
            field,
            item =>
              isRecord(value)
                ? compileFilter(value, name => item.child(name), depth + 1)
                : equals(item, value),
            depth
          )
        )
        break
      case 'startsWith': {
        if (typeof value !== 'string')
          throw new Error('startsWith requires a string')
        if (value === '') break
        // Unlike LIKE, percent and underscore are literal characters here.
        clauses.push(
          and(
            field.jsonType
              ? inArray(field.jsonType, ['text', 'string'])
              : sql.value(true),
            truth(
              sql`substr(${field.value}, 1, ${[...value].length}) = ${value}`
            )
          )
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
  field: (name: string) => QueryField,
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
  field: QueryField,
  predicate: (item: QueryField) => Sql<boolean>,
  depth = 0
): Sql<boolean> {
  const alias = sql.identifier(`alinea_item_${depth}`)
  const array = when(
    [eq(field.jsonType ?? sql.value(null), 'array'), field.value],
    '[]'
  )
  const target = sql.universal({
    sqlite: sql`json_each(${array}) as ${alias}`,
    postgres: sql`jsonb_array_elements((${array})::jsonb) as ${alias}(value)`,
    mysql: sql`json_table(${array}, '$[*]' columns (value json path '$')) as ${alias}`
  })
  const document = sql.universal({
    // json_each exposes scalar strings as SQL text, which is not valid JSON.
    sqlite: when(
      [inArray(sql`${alias}.type`, ['object', 'array']), sql`${alias}.value`],
      '{}'
    ),
    postgres: sql`${alias}.value`,
    mysql: sql`${alias}.value`
  })
  const item: QueryField = {
    value: sql.universal({
      sqlite: sql`${alias}.value`,
      postgres: sql`${alias}.value`,
      mysql: sql`${alias}.value`
    }),
    jsonType: sql.universal({
      sqlite: sql`${alias}.type`,
      postgres: sql`jsonb_typeof(${alias}.value)`,
      mysql: sql`lower(json_type(${alias}.value))`
    }),
    equals(value) {
      const json = JSON.stringify(value)
      return sql.universal<boolean>({
        sqlite: equals(
          {
            value: sql`${alias}.value`,
            jsonType: sql`${alias}.type`,
            child: name => jsonField(document, [name])
          },
          value
        ),
        postgres: truth(sql`${alias}.value = ${json}::jsonb`),
        mysql: truth(sql`${alias}.value = cast(${json} as json)`)
      })
    },
    child(name) {
      return jsonField(document, [name])
    }
  }
  return exists(
    new Builder().select(sql.value(1)).from(target).where(predicate(item))
  )
}
