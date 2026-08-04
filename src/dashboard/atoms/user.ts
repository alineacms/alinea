import {Policy} from '#/core/Role.js'
import {assert} from '#/core/util/Assert.js'
import {atom} from 'jotai'
import {selectAtom, unwrap} from 'jotai/utils'
import {authAtom} from './auth.js'
import {configAtom, graphAtom} from './core.js'
import {shaAtom} from './graph.js'
import type {PageAuth} from './nav.js'

export const userAtom = atom(get => {
  const auth = get(authAtom)
  if (auth.status === 'authenticated') return auth.user
  throw new Error('User is not authenticated')
})

const policyResult = atom(async get => {
  const user = get(userAtom)
  if (!user?.roles) return Policy.ALLOW_NONE
  const graph = get(graphAtom)
  get(shaAtom)
  const roles = get(configAtom).roles ?? {}
  return graph.createPolicy(user.roles.filter(role => role in roles))
})

const resolvedPolicy = unwrap(policyResult, previous => previous)
const stablePolicy = selectAtom(
  resolvedPolicy,
  policy => policy,
  (previous, next) =>
    previous === next || Boolean(previous && next && previous.equals(next))
)

export const authReady = atom(async (get): Promise<PageAuth> => {
  // Read the equality-filtered atom before awaiting so it observes this result.
  get(stablePolicy)
  await get(policyResult)
  const policy = get(stablePolicy)
  assert(policy, 'Dashboard policy was not resolved')
  return {
    user: get(userAtom),
    policy
  }
})
