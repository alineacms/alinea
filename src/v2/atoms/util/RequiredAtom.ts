import {type Atom, atom, useStore, type WritableAtom} from 'jotai'
import {useHydrateAtoms} from 'jotai/utils'
import {useLayoutEffect, useMemo} from 'react'

// 1. Unique symbol to represent the uninitialized state safely
const UNINITIALIZED = Symbol('UNINITIALIZED')

// 2. The Branded Read-Only Type
// This tricks TypeScript into treating the atom as read-only on the outside
export type RequiredAtom<Value> = Atom<Value> & {
  readonly __brand?: 'RequiredAtom'
}

/**
 * Creates a strict atom that throws an error if read before being hydrated.
 * It is branded as read-only to prevent accidental writes from child components.
 */
export function requiredAtom<Value>(
  errorMessage = 'Required atom was read before being hydrated!'
): RequiredAtom<Value> {
  const baseAtom = atom<Value | typeof UNINITIALIZED>(UNINITIALIZED)

  const derivedAtom = atom(
    get => {
      const value = get(baseAtom)
      if (value === UNINITIALIZED) {
        throw new Error(errorMessage)
      }
      return value
    },
    (_get, set, update: Value) => {
      set(baseAtom, update)
    }
  )

  // Cast the writable atom to our branded read-only type before exporting
  return derivedAtom as unknown as RequiredAtom<Value>
}

// Helper type to map an object of values to an object of RequiredAtoms
type AtomMap<T> = {
  [K in keyof T]: RequiredAtom<T[K]>
}

/**
 * Hydrates required atoms on mount and keeps them synced with incoming props.
 * This acts as the exclusive "write controller" for the strictly read-only RequiredAtoms.
 */
export function useRequiredAtoms<T extends Record<string, any>>(
  atoms: AtomMap<T>,
  values: T
) {
  const store = useStore()

  // 1. INITIAL MOUNT: Bypass the brand to hydrate the initial values
  const initialTuples = useMemo(() => {
    return new Map(
      Object.keys(atoms).map(key => [
        // Force cast the read-only atom back to a WritableAtom so Jotai can hydrate it
        atoms[key] as WritableAtom<unknown, [unknown], unknown>,
        values[key]
      ])
    )
  }, []) // Empty dependency array ensures we only capture the very first values

  useHydrateAtoms(initialTuples)

  // 2. SUBSEQUENT RENDERS: Sync prop changes into the atoms before the browser paints
  useLayoutEffect(() => {
    for (const key in atoms) {
      // Force cast back to writable atom to update the store safely
      const atom = atoms[key] as unknown as WritableAtom<
        T[keyof T],
        [T[keyof T]],
        void
      >
      const newValue = values[key]

      // Only update the Jotai store if the prop actually changed
      if (store.get(atom) !== newValue) {
        store.set(atom, newValue)
      }
    }
  }, [values, atoms, store])
}
