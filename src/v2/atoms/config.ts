import type {Config} from 'alinea/core/Config'
import {requiredAtom} from './util/RequiredAtom.js'

export const configAtom = requiredAtom<Config>()
