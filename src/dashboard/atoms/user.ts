import {Policy} from '#/core/Role.js'
import {graphSession} from '#/core/db/GraphSession.js'
import type {WritableGraph} from '#/core/db/WritableGraph.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {atom} from 'jotai'
import {selectAtom, unwrap} from 'jotai/utils'
import {authAtom} from './auth.js'
import {clientAtom, configAtom, graphAtom} from './core.js'
import {graphRevisionAtom, shaAtom} from './graph.js'

const userResult = atom(async get => {
  const auth = get(authAtom)
  if (auth.status === 'authenticated') {
    await graphSession(get(graphAtom))?.authenticate(auth.user)
    return auth.user
  }
  throw new Error('User is not authenticated')
})

const resolvedUser = unwrap(userResult, previous => previous)
const preloadedUserAtom = atom<User>()
const preloadedPolicyAtom = atom<Policy>()

export const userAtom = atom(get => {
  const auth = get(authAtom)
  const preloaded = get(preloadedUserAtom)
  const user =
    auth.status === 'authenticated' && preloaded?.sub === auth.user.sub
      ? preloaded
      : get(resolvedUser)
  assert(
    user && auth.status === 'authenticated' && user.sub === auth.user.sub,
    'Dashboard user was not preloaded'
  )
  return user
})

const policyResult = atom(async get => {
  const user = await get(userResult)
  const graph = get(graphAtom)
  get(graphRevisionAtom)
  await get(shaAtom)
  if (hasCompiledPolicy(graph))
    return {principal: user.sub, policy: await graph.compiledPolicy()}
  if (!user?.roles) return {principal: user.sub, policy: Policy.ALLOW_NONE}
  const roles = get(configAtom).roles ?? {}
  return {
    principal: user.sub,
    policy: await graph.createPolicy(user.roles.filter(role => role in roles))
  }
})

interface CompiledPolicyGraph {
  compiledPolicy(): Promise<Policy>
}

function hasCompiledPolicy(
  graph: WritableGraph
): graph is WritableGraph & CompiledPolicyGraph {
  return (
    typeof (graph as Partial<CompiledPolicyGraph>).compiledPolicy === 'function'
  )
}

const resolvedPolicy = unwrap(policyResult, previous => previous)
const resolvedPolicyAtom = selectAtom(
  resolvedPolicy,
  policy => policy,
  (previous, next) =>
    previous === next ||
    Boolean(
      previous &&
      next &&
      previous.principal === next.principal &&
      previous.policy.equals(next.policy)
    )
)

export const policyAtom = atom(get => {
  get(graphRevisionAtom)
  const auth = get(authAtom)
  const resolved = get(resolvedPolicyAtom)
  const principal = auth.status === 'authenticated' ? auth.user.sub : undefined
  const preloaded = get(preloadedUserAtom)
  const policy =
    principal && preloaded?.sub === principal
      ? get(preloadedPolicyAtom)
      : principal && resolved?.principal === principal
        ? resolved.policy
        : undefined
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

export const authReady = atom(async get => {
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
  const {policy} = await get(policyResult)
  return policy.canManageMembers()
})
