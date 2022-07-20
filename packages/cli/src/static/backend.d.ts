import type {Backend} from '@alinea/backend/Backend'
import {Config} from '@alinea/core'
import {config} from './config.js'
export const backend: Backend<Config.Infer<typeof config>>
