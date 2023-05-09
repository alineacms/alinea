import {Param, ParamData, ParamType} from './Param.js'

export class Statement {
  constructor(public sql: string, public params: Array<ParamData> = []) {}

  static EMPTY = new Statement('')

  static raw(sql: string) {
    return new Statement(sql)
  }

  static join(statements: Array<Statement | undefined>, separator: string) {
    const stmts = statements.filter(
      (maybe: Statement | undefined): maybe is Statement => {
        return Boolean(maybe && maybe.sql)
      }
    )
    return new Statement(
      stmts.map(s => s.sql).join(separator),
      stmts.flatMap(s => s.params)
    )
  }

  getParams(input?: Record<string, any>): Array<any> {
    return this.params.map(param => {
      switch (param.type) {
        case ParamType.Value:
          return param.value
        case ParamType.Named:
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
    if (insert instanceof Statement && insert.sql) {
      buf += insert.sql
      params.push(...insert.params)
    } else if (insert instanceof Param) {
      buf += '?'
      params.push(insert.param)
    }
  })
  return new Statement(buf, params)
}
