import type {EntryDB} from 'alinea/core/db/EntryDB'
import {useAtomValue} from 'jotai'
import {dbAtom} from '../atoms/DbAtoms.js'

export function useDb(): EntryDB {
  return useAtomValue(dbAtom)
}
