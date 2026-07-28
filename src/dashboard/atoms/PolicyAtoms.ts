import {Policy} from '#/core/Role.js'
import {atom} from 'jotai'
import {withPending} from './Async.js'
import {userAtom} from './AuthAtoms.js'
import {clientAtom, configAtom, graphAtom} from './CoreAtoms.js'
import {shaAtom} from './SyncAtoms.js'

export const backendCapabilitiesResourceAtom = atom(async get => {
  const client = get(clientAtom)
  if (!client.capabilities)
    throw new Error('Backend capabilities are not available')
  return client.capabilities()
})

export const policyResourceAtom = atom(async get => {
  const user = await get(userAtom)
  if (!user?.roles) return Policy.ALLOW_NONE
  const db = get(graphAtom)
  get(shaAtom)
  const roles = get(configAtom).roles ?? {}
  return db.createPolicy(user.roles.filter(role => role in roles))
})

const policyStateAtom = withPending(policyResourceAtom)

export const policyReadyAtom = atom(get => {
  const [pending] = get(policyStateAtom)
  return !pending
})

export const policyAtom = atom(get => {
  const [, policy] = get(policyStateAtom)
  return policy ?? Policy.ALLOW_NONE
})

export const canManageMembersAtom = atom(async get => {
  const capabilities = await get(backendCapabilitiesResourceAtom)
  if (!capabilities.users) return false
  const policy = await get(policyResourceAtom)
  return policy.canManageMembers()
})
