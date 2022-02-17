import {Param, ParamData} from './Param'

export class Statement {
  constructor(public sql: string, public params: Array<ParamData> = []) {}

  static EMPTY = new Statement('')

  static raw(sql: string) {
    return new Statement(sql)
  }

  getParams(input?: Record<string, any>): Array<any> {
    return this.params.map(param => {
      switch (param.type) {
        case 'value':
          return param.value
        case 'named':
          if (!input) throw 'Missing input'
          return input[param.name]
      }
    })
  }
}

export function sql(
  strings: TemplateStringsArray,
  ...inserts: Array<undefined | Param | Statement>
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
    }
  })
  return new Statement(buf, params)
}
