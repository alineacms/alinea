import {atom} from 'jotai'

export const errorMessageAtom = atom<string | null>(null)

export const errorAtom = atom(
  get => get(errorMessageAtom),
  (get, set, message: string | null, cause?: Error) => {
    set(errorMessageAtom, message)
    if (cause) console.error(cause)
  }
)
