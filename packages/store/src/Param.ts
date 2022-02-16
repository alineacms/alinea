export type ParamData =
  | {type: 'value'; value: any}
  | {type: 'named'; name: string}

export const ParamData = {
  Value(value: any): ParamData {
    return {type: 'value', value: value}
  },
  Named(name: string): ParamData {
    return {type: 'named', name: name}
  }
}

export class Param {
  constructor(public param: ParamData) {}
}
