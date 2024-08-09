const {setPrototypeOf} = Object

export class Callable {
  constructor(fn: Function) {
    return setPrototypeOf(fn, new.target.prototype)
  }
}

declare class ClearFunctionProto {
  // Clear the Function prototype, not sure if there's a better way
  // as mapped types (Omit) will remove the callable signature. We define them
  // in a class getter since it's the only way to also mark them as
  // non-enumerable, see also: Microsoft/TypeScript#27575
  get name(): unknown
  get length(): unknown
  get call(): unknown
  get caller(): unknown
  get apply(): unknown
  get bind(): unknown
  get prototype(): unknown
  get arguments(): unknown
}

export interface Callable extends ClearFunctionProto {}
