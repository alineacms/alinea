import {
  observable as microObservable,
  Observable as MicroObservable,
  useObservable as useMicroObservable,
  WritableObservable as MicroWritableObservable
} from 'micro-observables'

export interface Observable<T> {
  (): T
  micro: MicroObservable<T>
  select<U>(selector: (val: T) => U | Observable<U>): Observable<U>
}

export namespace Observable {
  export interface Writable<T> extends Observable<T> {
    (value: T): void
  }
}

function wrap<T>(micro: MicroObservable<T>): Observable<T> {
  return Object.assign(
    function () {
      if (arguments.length === 1)
        return (micro as MicroWritableObservable<T>).set(arguments[0])
      return micro.get()
    },
    {
      micro,
      select<U extends object>(
        selector: (val: T) => U | Observable<U>
      ): Observable<U> {
        return wrap(
          micro.select(val => {
            const res = selector(val)
            return 'micro' in res ? res.micro : res
          })
        )
      }
    }
  ) as Observable<T>
}

export function observable<T>(value: T) {
  return wrap(microObservable<T>(value)) as Observable.Writable<T>
}

export function useObservable<T>(
  observable: Observable<T> | MicroObservable<T>
) {
  return useMicroObservable(
    'micro' in observable ? observable.micro : observable
  )
}
