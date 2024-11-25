import {Expr} from '../Expr.js'

export function snippet(
  start = '<mark>',
  end = '</mark>',
  cutOff = '...',
  limit = 64
): Expr<string> {
  return new Expr({
    type: 'call',
    method: 'snippet',
    args: [
      new Expr({type: 'value', value: start}),
      new Expr({type: 'value', value: end}),
      new Expr({type: 'value', value: cutOff}),
      new Expr({type: 'value', value: limit})
    ]
  })
}
