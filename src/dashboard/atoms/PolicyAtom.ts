import {Policy} from 'alinea/core/Role'
import {atom} from 'jotai'
import {sessionAtom} from '../atoms/DashboardAtoms.js'
import {dbAtom, dbMetaAtom} from '../atoms/DbAtoms.js'
import {keepPreviousData} from '../util/KeepPreviousData.js'

export const policyAtom = keepPreviousData(
  atom(async get => {
    const session = get(sessionAtom)
    if (!session) return Policy.ALLOW_NONE
    const db = get(dbAtom)
    const meta = await get(dbMetaAtom)
    return db.createPolicy(session.user.roles)
  })
)
