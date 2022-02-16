export type Param = {type: 'value'; value: any} | {type: 'named'; name: string}

export const Param = {
  Value(value: any): Param {
    return {type: 'value', value: value}
  },
  Named(name: string): Param {
    return {type: 'named', name: name}
  }
}
