import {Policy} from '#/core/Role.js'
import {assert} from '#/core/util/Assert.js'
import {atom} from 'jotai'
import {selectAtom, unwrap} from 'jotai/utils'
import {authAtom} from './auth.js'
import {configAtom, graphAtom} from './core.js'
import {shaAtom} from './graph.js'

export const userAtom = atom(get => {
  const auth = get(authAtom)
  if (auth.status === 'authenticated') return auth.user
  throw new Error('User is not authenticated')
})

const policyResource = atom(async get => {
  const user = get(userAtom)
  if (!user?.roles) return Policy.ALLOW_NONE
  const graph = get(graphAtom)
  get(shaAtom) // subscribe to content changes
  const roles = get(configAtom).roles ?? {}
  return graph.createPolicy(user.roles.filter(role => role in roles))
})

export const policyReady = atom(get => get(policyResource).then(Boolean))

// compare vs previous policy to avoid unnecessary re-renders
const stablePolicyAtom = selectAtom(
  unwrap(policyResource),
  policy => policy,
  (a, b) => (a && b ? a.equals(b) : false)
)

export const policyAtom = atom(get => {
  const policy = get(stablePolicyAtom)
  assert(policy, 'Policy is not ready')
  return policy
})
