import {type Sql, sql} from 'rado'
import {input, type Input} from 'rado/core/expr/Input'

export function is<T>(a: Input<T>, b: Input<T>): Sql<boolean> {
  return sql`${input(a)} is ${input(b)}`
}

export function values<const Values extends Array<Input>>(
  ...rows: Array<Values>
): Sql<Array<Values>> {
  return sql`(values ${sql.join(
    rows.map(row => sql`(${sql.join(row.map(input), sql`, `).inlineValues()})`),
    sql`, `
  )})`
}
