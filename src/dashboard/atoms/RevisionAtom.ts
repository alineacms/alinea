import {atom} from 'jotai'
import {dispense} from './AtomUtils.js'

export const entryRevisionAtom = dispense((_id: string) => atom(0))
