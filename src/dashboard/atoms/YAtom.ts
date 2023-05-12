import {PrimitiveAtom, atom} from 'jotai'
import * as Y from 'yjs'

/*interface YAtomOptions<T, YType extends Y.AbstractType<any>> {
  type: YType
  get: (this: YType) => T
  set?: (this: YType, value: T) => void
}*/

export function yAtom<T>(
  yType: Y.AbstractType<any>,
  get: () => T,
  set?: (value: T) => void
): PrimitiveAtom<T> {
  const res = atom<T>(get())
  function onMount(setAtom: (value: T) => void) {
    // Since we only start observing after the atom is mounted, we need to
    // set the initial data again here as well as it may have changed since
    setAtom(get())
    const onChange = () => setAtom(get())
    yType.observeDeep(onChange)
    return () => yType.unobserveDeep(onChange)
  }
  res.onMount = onMount
  if (!set) return res
  return atom(
    get => get(res),
    (_, __, value: T) => {
      set(value)
    }
  ) as PrimitiveAtom<T>
}
