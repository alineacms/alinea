import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {assert} from '#/core/util/Assert.js'
import {atom} from 'jotai'
import {ComponentType} from 'react'
import {configAtom, viewsAtom} from './core.js'
import {policyAtom} from './user.js'
import {dispense} from './utils.js'

export const workspacesAtom = atom(get => {
  const config = get(configAtom)
  const policy = get(policyAtom)
  return Object.keys(config.workspaces).filter(workspace => {
    return policy.canRead({workspace})
  })
})

export const workspaceAtoms = dispense(workspaceKey => {
  assert(workspaceKey, 'Workspace key cannot be empty')
  const settingsAtom = atom(get => {
    const config = get(configAtom)
    const workspaceConfig = config.workspaces[workspaceKey]
    assert(workspaceConfig, `Workspace "${workspaceKey}" not found in config`)
    return getWorkspace(workspaceConfig)
  })
  const rootsAtom = dispense(rootKey => {
    const languagePreferenceAtom = atom<string>()
    return atom(get => {
      const workspaceConfig = get(settingsAtom)
      const rootConfig = workspaceConfig.roots[rootKey]
      assert(
        rootConfig,
        `Root "${rootKey}" not found in workspace "${workspaceKey}"`
      )
      return {...getRoot(rootConfig), languagePreferenceAtom}
    })
  })
  return {settingsAtom, rootsAtom}
})

export const viewAtoms = dispense(key => {
  return atom((get): ComponentType | undefined => {
    const views = get(viewsAtom)
    return views[key]
  })
})

export const typeAtoms = dispense(typeName => {
  return atom(get => {
    const config = get(configAtom)
    const type = config.schema[typeName]
    assert(type, `Type "${typeName}" not found in config`)
    const typeConfig = getType(type)

    const customView =
      typeof typeConfig.view === 'string'
        ? get(viewAtoms(typeConfig.view))
        : typeConfig.view

    return {...typeConfig, type, customView}
  })
})
