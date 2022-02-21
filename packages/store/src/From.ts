import {ExprData} from './Expr'

export const enum FromType {
  Table,
  Column,
  Join
}

export type From =
  | {type: FromType.Table; name: string; columns: Array<string>; alias?: string}
  | {type: FromType.Column; of: From; column: string}
  | {
      type: FromType.Join
      left: From
      right: From
      join: 'left' | 'inner'
      on: ExprData
    }

export namespace From {
  export function Table(
    name: string,
    columns: Array<string>,
    alias?: string
  ): From {
    return {type: FromType.Table, name, columns, alias}
  }
  export function Column(of: From, column: string): From {
    return {type: FromType.Column, of, column}
  }
  export function Join(
    left: From,
    right: From,
    join: 'left' | 'inner',
    on: ExprData
  ): From {
    return {type: FromType.Join, left, right, join, on}
  }
  export function source(from: From): string {
    switch (from.type) {
      case FromType.Table:
        return from.alias || from.name
      case FromType.Column:
        return source(from.of)
      default:
        throw 'assert'
    }
  }
  export function path(from: From): Array<string> {
    switch (from.type) {
      case FromType.Column:
        return [...path(from.of), from.column]
      case FromType.Table:
        return [from.alias || from.name]
      default:
        throw 'assert'
    }
  }
}
