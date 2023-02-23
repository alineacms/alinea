import {Outcome} from './Outcome'

export type Future<T = void> = Promise<Outcome<T>>

export function future<T>(promise: Promise<T>) {
  return promise.then(Outcome.Success).catch(Outcome.Failure) as Future<T>
}
