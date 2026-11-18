import {atom} from 'jotai'
import {atomWithStorage, unwrap} from 'jotai/utils'
import {authAtom} from './auth.js'
import {clientAtom} from './core.js'

/** Whether this editor edits entries together with others, where it can */
export const liveEditingAtom = atomWithStorage(
  'alinea-dashboard-live-editing',
  false,
  undefined,
  {getOnInit: true}
)

/** Whether the project lets editors edit together */
export const sessionsAvailableAtom = unwrap(
  atom(async get => {
    const client = get(clientAtom)
    if (!client.live) return false
    const auth = get(authAtom)
    const capabilities =
      (auth.status === 'authenticated' ? auth.capabilities : undefined) ??
      (await client.capabilities())
    return Boolean(capabilities.sessions)
  }),
  () => false
)
