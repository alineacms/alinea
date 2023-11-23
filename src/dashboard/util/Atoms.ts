import {Atom, atom} from 'jotai'

const cached = new WeakMap<Atom<any>, any>()

// Read atom value without subscribing to updates
export function peek<T>(readable: Atom<T>): Atom<T> {
  if (cached.has(readable)) return cached.get(readable)
  const currentAtom = atom(undefined as T)
  const resultAtom = atom(
    get => get(currentAtom) || get(readable),
    (get, set) => set(currentAtom, get(readable))
  )
  resultAtom.onMount = dispatch => dispatch()
  cached.set(readable, resultAtom)
  return resultAtom
}
