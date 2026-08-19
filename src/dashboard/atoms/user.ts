import {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {atom} from 'jotai'
import {selectAtom, unwrap} from 'jotai/utils'
import {authAtom} from './auth.js'
import {clientAtom, configAtom, graphAtom} from './core.js'
import {shaAtom} from './graph.js'

const userResult = atom(async get => {
  const auth = get(authAtom)
  if (auth.status === 'authenticated') return auth.user
  throw new Error('User is not authenticated')
})

const resolvedUser = unwrap(userResult, previous => previous)
const preloadedUserAtom = atom<User>()
const preloadedPolicyAtom = atom<Policy>()

export const userAtom = atom(get => {
  const user = get(preloadedUserAtom) ?? get(resolvedUser)
  assert(user, 'Dashboard user was not preloaded')
  return user
})

const policyResult = atom(async get => {
  const user = await get(userResult)
  if (!user?.roles) return Policy.ALLOW_NONE
  const graph = get(graphAtom)
  get(shaAtom)
  const roles = get(configAtom).roles ?? {}
  return graph.createPolicy(user.roles.filter(role => role in roles))
})

const resolvedPolicy = unwrap(policyResult, previous => previous)
const resolvedPolicyAtom = selectAtom(
  resolvedPolicy,
  policy => policy,
  (previous, next) =>
    previous === next || Boolean(previous && next && previous.equals(next))
)

export const policyAtom = atom(get => {
  const policy = get(preloadedPolicyAtom) ?? get(resolvedPolicyAtom)
  assert(policy, 'Dashboard policy was not preloaded')
  return policy
})

export const preloadUserPolicyAtom = atom(
  null,
  (_get, set, user: User, policy: Policy) => {
    set(preloadedUserAtom, user)
    set(preloadedPolicyAtom, policy)
  }
)

export const preloadPolicyAtom = atom(null, (_get, set, policy: Policy) => {
  set(preloadedPolicyAtom, policy)
})

export const authReady = atom(async get => {
  if (get(preloadedUserAtom) && get(preloadedPolicyAtom)) return
  // Observe the unwrapped atoms before awaiting so they retain their resolved
  // values while their resources revalidate.
  get(resolvedUser)
  await get(userResult)
  get(userAtom)
  get(resolvedPolicyAtom)
  await get(policyResult)
  get(policyAtom)
})

export const canManageMembersAtom = atom(async get => {
  const capabilities = await get(clientAtom).capabilities()
  if (!capabilities.users) return false
  await get(authReady)
  return get(policyAtom).canManageMembers()
})
