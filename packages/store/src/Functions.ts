import {EV, Expr, ExprData} from './Expr'

function get(_: any, method: string) {
  return (...args: any[]) => {
    return new Expr(ExprData.Call(method, args.map(ExprData.create)))
  }
}

export const Functions = new Proxy({}, {get}) as Functions

/** These will have to be supported in every driver */
export type Functions = {
  arrayLength(x: EV<Array<any>>): Expr<number>
  count(x?: Expr<any>): Expr<number>
  iif<T>(x: EV<boolean>, y: EV<T>, z: EV<T>): Expr<T>
}
