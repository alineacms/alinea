import {Sql, sql} from 'rado'
import {input, Input} from 'rado/core/expr/Input'

export function is<T>(a: Input<T>, b: Input<T>): Sql<boolean> {
  return sql`${input(a)} is ${input(b)}`
}
