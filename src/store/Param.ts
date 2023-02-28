export const enum ParamType {
  Value,
  Named
}

export type ParamData =
  | {type: ParamType.Value; value: any}
  | {type: ParamType.Named; name: string}

export const ParamData = {
  Value(value: any): ParamData {
    return {type: ParamType.Value, value: value}
  },
  Named(name: string): ParamData {
    return {type: ParamType.Named, name: name}
  }
}

export class Param {
  constructor(public param: ParamData) {}

  static value(value: any) {
    return new Param(ParamData.Value(value))
  }
}
