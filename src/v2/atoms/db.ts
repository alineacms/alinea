import type {LocalDB} from 'alinea/core/db/LocalDB'
import {requiredAtom} from './util/RequiredAtom.js'

export const dbAtom = requiredAtom<LocalDB>()
