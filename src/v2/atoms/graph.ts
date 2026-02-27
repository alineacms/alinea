import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {atom} from 'jotai'
import {dbAtom} from './db.js'

export const graphAtom = atom<WriteableGraph>(get => {
  return get(dbAtom)
})
