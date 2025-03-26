import type {LocalDB} from 'alinea/core/db/LocalDB.js'
import {useAtomValue} from 'jotai'
import {dbAtom} from '../atoms/DbAtoms.js'

export function useDb(): LocalDB {
  return useAtomValue(dbAtom)
}
