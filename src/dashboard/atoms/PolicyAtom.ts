import type {Policy} from 'alinea/core/Role'
import {assert} from 'alinea/core/source/Utils'
import {type Atom, atom} from 'jotai'
import {sessionAtom} from '../atoms/DashboardAtoms.js'
import {dbAtom} from '../atoms/DbAtoms.js'
import {keepPreviousData} from '../util/KeepPreviousData.js'

export const policyTrigger = keepPreviousData(
  atom(async get => {
    const session = get(sessionAtom)
    assert(session)
    const db = get(dbAtom)
    const policy = await db.createPolicy(session.user.roles)
    return policy
  }),
  {
    compare(a: Policy, b: Policy) {
      return a.equals(b)
    }
  }
)

export const policyAtom = policyTrigger.current as Atom<Policy>
