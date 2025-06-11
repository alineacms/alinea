import type {Policy} from 'alinea/core/Role'
import {assert} from 'alinea/core/source/Utils'
import {type Atom, atom} from 'jotai'
import {sessionAtom} from '../atoms/DashboardAtoms.js'
import {dbAtom} from '../atoms/DbAtoms.js'
import {keepPreviousData} from '../util/KeepPreviousData.js'

export const policyTrigger = keepPreviousData(
  atom(get => {
    const session = get(sessionAtom)
    assert(session)
    const db = get(dbAtom)
    return db.createPolicy(session.user.roles)
  })
)

export const policyAtom = policyTrigger.current as Atom<Policy>
