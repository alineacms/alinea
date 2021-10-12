type JSONRep<D, F> = {success: true; data: D} | {success: false; error: F}

export class Outcome<D, F = Error> {
  /** @internal */ constructor(public success: boolean) {}

  isSuccess(): this is Success<D, F> {
    return this.success
  }

  isFailure(): this is Failure<D, F> {
    return this.success
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
