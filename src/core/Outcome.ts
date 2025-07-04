import {type ErrorCode, HttpError} from './HttpError.js'
import {assign} from './util/Objects.js'

type ErrorObject = {
  stack?: string
  message?: string
  status?: number
}

export type OutcomeJSON<D> =
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

export function outcome<Run extends OutcomeRunner>(
  run: Run
): OutcomeReturn<Run> {
  try {
    if (typeof run === 'function') {
      const result = run()
      if (isPromiseLike(result)) return outcome(result) as any
      return Outcome.Success(result) as any
    }
    if (isPromiseLike(run))
      return run.then(Outcome.Success).catch(Outcome.Failure) as any
    return Outcome.Success(run) as any
  } catch (e: any) {
    return Outcome.Failure(e) as any
  }
}

function isPromiseLike(value: any): value is Promise<unknown> {
  return value && typeof value === 'object' && 'then' in value
}

export namespace outcome {
  export function succeeds<Run extends OutcomeRunner>(
    run: OutcomeRunner
  ): OutcomeResult<Run> {
    const result: Promise<Outcome<any>> | Outcome<any> = outcome(run) as any
    if ('then' in result)
      return result.then(outcome => outcome.isSuccess()) as any
    return result.isSuccess() as any
  }
  export function fails<Run extends OutcomeRunner>(
    run: OutcomeRunner
  ): OutcomeResult<Run> {
    const result: Promise<Outcome<any>> | Outcome<any> = outcome(run) as any
    if ('then' in result)
      return result.then(outcome => outcome.isFailure()) as any
    return result.isFailure() as any
  }
}

export type Outcome<T = void> = Outcome.OutcomeImpl<T> & Pair<T>

export namespace Outcome {
  export function fromJSON<T>(
    json: OutcomeJSON<T>,
    status?: ErrorCode
  ): Outcome<T> {
    if (json.success) return Success(json.data)
    const error = new HttpError(
      json.error.status ?? status ?? 500,
      json.error.message ?? 'Unknown error'
    )
    assign(error, json.error)
    if (json.error.stack) error.stack = json.error.stack
    return Failure(error)
  }

  export function unpack<T>(outcome: Outcome<T>): T {
    if (outcome.isSuccess()) return outcome.value
    if (outcome.isFailure()) throw outcome.error
    throw new Error('Outcome is neither success nor failure')
  }

  export function isOutcome(value: any): value is Outcome {
    return value instanceof OutcomeImpl
  }

  export function Success<T>(data: T): Outcome<T> {
    return new SuccessOutcome(data) as any
  }

  export function Failure<T = any>(error: Error | any): Outcome<T> {
    return new FailureOutcome(
      error instanceof Error ? error : new Error(error)
    ) as any
  }

  export abstract class OutcomeImpl<T> {
    abstract status: number
    constructor(public success: boolean) {}

    isSuccess(): this is SuccessOutcome<T> {
      return this.success
    }

    isFailure(): this is FailureOutcome<T> {
      return !this.success
    }

    abstract map<U>(fn: (data: T) => U): Outcome<U>
    abstract toJSON(): OutcomeJSON<T>
  }

  class SuccessOutcome<T> extends OutcomeImpl<T> {
    status = 200
    error = undefined
    constructor(public value: T) {
      super(true)
    }

    *[Symbol.iterator]() {
      yield this.value
      yield undefined
    }

    map<U>(fn: (data: T) => U): Outcome<U> {
      return Success(fn(this.value))
    }

    toJSON(): OutcomeJSON<T> {
      return {success: true, data: this.value}
    }
  }

  class FailureOutcome<T> extends OutcomeImpl<T> {
    status
    value = undefined
    constructor(public error: Error) {
      super(false)
      this.status = error instanceof HttpError ? error.code : 500
    }

    *[Symbol.iterator]() {
      yield undefined
      yield this.error
    }

    map<U>(fn: (data: T) => U): Outcome<U> {
      return this as any as Outcome<U>
    }

    toJSON(): OutcomeJSON<T> {
      return {
        success: false,
        error: {
          message: String(this.error),
          stack: this.error instanceof Error ? this.error.stack : undefined,
          status: this.status
        }
      }
    }
  }
}
