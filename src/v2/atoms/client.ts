import type {LocalConnection} from 'alinea/core/Connection'
import {requiredAtom} from './util/RequiredAtom.js'

export const client = requiredAtom<LocalConnection>()
