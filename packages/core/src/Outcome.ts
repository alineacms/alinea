type JSONRep<D, F> = {success: true; data: D} | {success: false; error: F}

type OutcomeRunner = (() => any) | Promise<any>

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

export class Outcome<D, F = Error> {
  /** @internal */ constructor(public success: boolean) {}

  isSuccess(): this is Success<D, F> {
    return this.success
  }

  isFailure(): this is Failure<D, F> {
    return !this.success
  }

  get pair(): [D, undefined] | [undefined, F] {
    throw 'implement'
  }

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
  constructor(public data: D) {
    super(true)
  }

  get pair(): [D, undefined] {
    return [this.data, undefined]
  }

  toJSON(): JSONRep<D, F> {
    return {success: true, data: this.data}
  }
}

class Failure<D, F> extends Outcome<D, F> {
  constructor(public error: F) {
    super(false)
  }

  get pair(): [undefined, F] {
    return [undefined, this.error]
  }

  toJSON(): JSONRep<D, F> {
    return {success: false, error: this.error}
  }
}
