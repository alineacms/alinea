import {and, eq, or, sql, when, type HasSql} from 'rado'
import {jsonField, type QueryField} from './Condition.js'

/** Both historical alias locations contribute, in authored order. */
export function aliasesField(data: HasSql): QueryField {
  const top = jsonField(data, ['aliases'])
  const nested = jsonField(data, ['metadata', 'aliases'])
  const topArray = eq(top.jsonType!, 'array')
  const nestedArray = eq(nested.jsonType!, 'array')
  const a = when([topArray, top.value], '[]')
  const b = when([nestedArray, nested.value], '[]')
  const separator = when(
    [
      and(sql`json_array_length(${a}) > 0`, sql`json_array_length(${b}) > 0`),
      ','
    ],
    ''
  )
  const merged = sql.universal({
    sqlite: sql`substr(${a}, 1, length(${a}) - 1) || ${separator} || substr(${b}, 2)`,
    postgres: sql`(${a})::jsonb || (${b})::jsonb`,
    mysql: sql`json_merge_preserve(${a}, ${b})`
  })
  return jsonField(when([or(topArray, nestedArray), merged], sql.value(null)))
}
