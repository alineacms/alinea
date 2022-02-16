import {Param, ParamData} from './Param'

export class Statement {
  constructor(public sql: string, public params: Array<ParamData>) {}
}

export function sql(
  strings: TemplateStringsArray,
  ...inserts: Array<string | Param | Statement>
): Statement {
  let buf = '',
    params: Array<ParamData> = []
  strings.forEach((string, i) => {
    buf += string
    const insert = inserts[i]
    if (insert instanceof Statement) {
      buf += insert.sql
      params.push(...insert.params)
    } else if (insert instanceof Param) {
      buf += ' ? '
      params.push(insert.param)
    } else if (typeof insert === 'string') {
      buf += inserts[i]
    }
  })
  return new Statement(buf, params)
}
