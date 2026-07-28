import {getWorkspace} from '#/core/Internal.js'
import {assert} from '#/core/util/Assert.js'
import {atom} from 'jotai'
import {configAtom} from './CoreAtoms.js'
import {routeAtom} from './NavigationAtoms.js'
import {policyAtom} from './PolicyAtoms.js'
import {dispense} from './AtomUtils.js'

export const workspaceSettingsAtom = dispense((key: string) =>
  atom(get => {
    const workspace = get(configAtom).workspaces[key]
    assert(workspace, `Workspace "${key}" not found in config`)
    return getWorkspace(workspace)
  })
)

export const workspaceRootsAtom = dispense((key: string) =>
  atom(get => {
    const configuredRoots = get(workspaceSettingsAtom(key)).roots
    const policy = get(policyAtom)
    return Object.keys(configuredRoots).filter(root =>
      policy.canRead({workspace: key, root})
    )
  })
)

export const workspacesAtom = atom(get => {
  const config = get(configAtom)
  const policy = get(policyAtom)
  return Object.keys(config.workspaces).filter(workspace =>
    policy.canRead({workspace})
  )
})

export const selectedWorkspaceAtom = atom(
  get => {
    const {workspace} = get(routeAtom)
    const config = get(configAtom)
    const workspaceKeys = get(workspacesAtom)
    if (
      workspace &&
      config.workspaces[workspace] &&
      workspaceKeys.includes(workspace)
    )
      return workspace
    return workspaceKeys[0] ?? null
  },
  (_get, set, workspace: string) => set(routeAtom, {workspace})
)

export const selectedRootAtom = atom<string | null>(get => {
  const workspace = get(selectedWorkspaceAtom)
  const roots = workspace ? get(workspaceRootsAtom(workspace)) : []
  const {root} = get(routeAtom)
  if (root && roots.includes(root)) return root
  return roots[0] ?? null
})
