import {ExprData} from './Expr'

export type From =
  | {type: 'table'; name: string; columns: Array<string>; alias?: string}
  | {type: 'column'; of: From; column: string}
  | {
      type: 'join'
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
    return {type: 'table', name, columns, alias}
  }
  export function Column(of: From, column: string): From {
    return {type: 'column', of, column}
  }
  export function Join(
    left: From,
    right: From,
    join: 'left' | 'inner',
    on: ExprData
  ): From {
    return {type: 'join', left, right, join, on}
  }
  export function source(from: From): string {
    switch (from.type) {
      case 'table':
        return from.alias || from.name
      case 'column':
        return source(from.of)
      default:
        throw 'Cannot source join'
    }
  }
  export function path(from: From): Array<string> {
    switch (from.type) {
      case 'column':
        return [...path(from.of), from.column]
      case 'table':
        return [from.alias || from.name]
      default:
        throw 'Cannot field access'
    }
  }
}
