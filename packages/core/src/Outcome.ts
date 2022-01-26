import {deserializeError, ErrorObject, serializeError} from 'serialize-error'
import {createError} from './ErrorWithCode'

type JSONRep<D> =
  | {success: true; data: D}
  | {success: false; error: ErrorObject}

type OutcomeRunner = (() => any) | Promise<any>

type Pair<T> = [T, undefined] | [undefined, Error]

type OutcomeReturn<T> = T extends () => Promise<infer X>
  ? Promise<Outcome<X>>
  : T extends () => infer X
  ? Outcome<X>
  : T extends Promise<infer X>
  ? Promise<Outcome<X>>
  : Outcome<T>

type OutcomeResult<T> = T extends () => Promise<any>
  ? Promise<boolean>
  : T extends () => any
  ? boolean
  : T extends Promise<any>
  ? Promise<boolean>
  : boolean

function outcomeRunner<Run extends OutcomeRunner>(
  run: Run
): OutcomeReturn<Run> {
  try {
    if (typeof run === 'function') {
      const result = run()
      if (result instanceof Promise) return outcome(result) as any
      return Outcome.Success(result) as any
    }
    if (run instanceof Promise)
      return run.then(Outcome.Success).catch(Outcome.Failure) as any
    return Outcome.Success(run) as any
  } catch (e: any) {
    return Outcome.Failure(e) as any
  }
}

export const outcome = Object.assign(outcomeRunner, {
  succeeds<Run extends OutcomeRunner>(run: OutcomeRunner): OutcomeResult<Run> {
    const result: Promise<Outcome<any>> | Outcome<any> = outcomeRunner(
      run
    ) as any
    if (result instanceof Promise)
      return result.then(outcome => outcome.isSuccess()) as any
    return result.isSuccess() as any
  },
  fails<Run extends OutcomeRunner>(run: OutcomeRunner): OutcomeResult<Run> {
    const result: Promise<Outcome<any>> | Outcome<any> = outcomeRunner(
      run
    ) as any
    if (result instanceof Promise)
      return result.then(outcome => outcome.isFailure()) as any
    return result.isFailure() as any
  }
})

export type Outcome<T = void> = Outcome.OutcomeImpl<T> & Pair<T>

export namespace Outcome {
  export function fromJSON<T>(json: JSONRep<T>): Outcome<T> {
    if (json.success) return Success(json.data)
    return Failure(deserializeError(json.error)) as any
  }

  export function Success<T>(data: T): Outcome<T> {
    return new SuccessOutcome(data) as any
  }

  export function Failure(error: Error | any): Outcome<unknown> {
    return new FailureOutcome(
      error instanceof Error ? error : createError(error)
    ) as any
  }

  export abstract class OutcomeImpl<T> {
    constructor(public success: boolean) {}

    isSuccess(): this is SuccessOutcome<T> {
      return this.success
    }

    isFailure(): this is FailureOutcome<T> {
      return !this.success
    }

    abstract toJSON(): JSONRep<T>
  }

  class SuccessOutcome<T> extends OutcomeImpl<T> {
    constructor(public value: T) {
      super(true)
    }

    *[Symbol.iterator]() {
      yield this.value
      yield undefined
    }

    toJSON(): JSONRep<T> {
      return {success: true, data: this.value}
    }
  }

  class FailureOutcome<T> extends OutcomeImpl<T> {
    constructor(public error: Error) {
      super(false)
    }

    *[Symbol.iterator]() {
      yield undefined
      yield this.error
    }

    toJSON(): JSONRep<T> {
      return {success: false, error: serializeError(this.error)}
    }
  }
}
/*
export abstract class Outcome<D = void, F = Error> {
  constructor(public success: boolean) {}

  isSuccess(): this is Success<D, F> {
    return this.success
  }

  isFailure(): this is Failure<D, F> {
    return !this.success
  }

  abstract get pair(): [D, undefined] | [undefined, F]

  static fromJSON<D, F>(json: JSONRep<D, F>): Outcome<D, F> {
    if (json.success) return Outcome.Success(json.data)
    else return Outcome.Failure(json.error)
  }

  static attempt<D>(run: () => D): Outcome<D> {
    try {
      return Outcome.Success(run())
    } catch (e: any) {
      return Outcome.Failure(e)
    }
  }

  static async promised<F>(run: () => Promise<F>): Promise<Outcome<F>> {
    try {
      return Outcome.Success(await run())
    } catch (e: any) {
      return Outcome.Failure(e)
    }
  }

  static Success<D, F = Error>(data: D): Outcome<D, F> {
    return new Success(data)
  }

  static Failure<D, F = Error>(error: F): Outcome<D, F> {
    return new Failure(error)
  }
}

class Success<D, F> extends Outcome<D, F> {
  constructor(public value: D) {
    super(true)
  }

  *[Symbol.iterator]() {
    yield this.value
    yield undefined
  }

  get pair(): [D, undefined] {
    return [this.value, undefined]
  }

  toJSON(): JSONRep<D, F> {
    return {success: true, data: this.value}
  }
}

class Failure<D, F> extends Outcome<D, F> {
  constructor(public error: F) {
    super(false)
  }

  *[Symbol.iterator]() {
    yield undefined
    yield this.error
  }

  get pair(): [undefined, F] {
    return [undefined, this.error]
  }

  toJSON(): JSONRep<D, F> {
    return {success: false, error: this.error}
  }
}
*/
