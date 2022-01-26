import {useEffect, useState} from 'react'

type Listener<T> = (value: T) => void

export type Observable<T> = {
  (): T
  (value: T): T
  map<X>(mapping: (value: T) => X): Observable<X>
  subscribe(listener: Listener<T>): void
  destroy(): void
}

export function observable<T>(value: T): Observable<T> {
  const listeners = new Set<Listener<T>>()
  function subscribe(listener: (value: T) => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  function destroy() {
    listeners.clear()
  }
  function map<X>(mapping: (value: T) => X): Observable<X> {
    const res = observable(mapping(value))
    subscribe(value => res(mapping(value)))
    return res
  }
  return Object.assign(
    function () {
      if (arguments.length === 0) return value
      value = arguments[0]
      for (const listener of listeners) listener(value)
      return value
    },
    {
      subscribe,
      destroy,
      map
    }
  )
}

// Todo: use some reactive state lib?
export function useObservable<T>(observable: Observable<T>) {
  const [state, setState] = useState<T>(observable)
  useEffect(() => {
    return observable.subscribe(setState)
  }, [])
  return state
}
