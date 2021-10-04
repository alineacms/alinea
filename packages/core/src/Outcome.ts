export type Outcome<Data, Failure = Error> =
  | OutcomeSuccess<Data>
  | OutcomeFailure<Failure>

export type OutcomeSuccess<Data> = {success: true; data: Data}
export type OutcomeFailure<Failure> = {success: false; error: Failure}

export namespace Outcome {
  export function Success<Data, Failure = Error>(
    data: Data
  ): Outcome<Data, Failure> {
    return {success: true, data}
  }

  export function Failure<Data, Failure>(
    error: Failure
  ): Outcome<Data, Failure> {
    return {success: false, error}
  }

  export function isOutcome(input: any): input is Outcome<unknown> {
    return input && typeof input === 'object' && 'success' in input
  }

  export function isSuccess<T>(
    outcome: Outcome<T, unknown>
  ): outcome is OutcomeSuccess<T> {
    return outcome && outcome.success
  }

  export function isFailure<T>(
    outcome: Outcome<unknown, T>
  ): outcome is OutcomeFailure<T> {
    return !outcome.success
  }

  export function attempt<Data>(run: () => Data): Outcome<Data> {
    try {
      return Outcome.Success(run())
    } catch (e: any) {
      return Outcome.Failure(e)
    }
  }
}
