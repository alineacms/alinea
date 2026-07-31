import {getWorkspace} from '#/core/Internal.js'
import {assert} from '#/core/util/Assert.js'
import {atom} from 'jotai'
import {configAtom} from './core.js'
import {policyAtom} from './user.js'
import {dispense} from './utils.js'

export const workspacesAtom = atom(get => {
  const config = get(configAtom)
  const policy = get(policyAtom)
  return Object.keys(config.workspaces).filter(workspace => {
    return policy.canRead({workspace})
  })
})

export const workspaceAtoms = dispense(key => {
  assert(key, 'Workspace key cannot be empty')
  return atom(get => {
    const config = get(configAtom)
    const workspaceConfig = config.workspaces[key]
    assert(workspaceConfig, `Workspace "${key}" not found in config`)
    return getWorkspace(workspaceConfig)
  })
})
