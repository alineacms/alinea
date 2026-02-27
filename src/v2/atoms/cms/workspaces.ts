import {atom} from 'jotai'
import {configAtom} from '../config.js'
import {cmsRouteAtom} from './route.js'

export const currentWorkspaceAtom = atom(
  get => {
    const config = get(configAtom)
    const route = get(cmsRouteAtom)
    const names = Object.keys(config.workspaces)
    if (route.workspace && config.workspaces[route.workspace]) {
      return route.workspace
    }
    return names[0] ?? ''
  },
  (get, set, nextWorkspace: string) => {
    const config = get(configAtom)
    if (!config.workspaces[nextWorkspace]) return
    const route = get(cmsRouteAtom)
    const keepScope = route.workspace === nextWorkspace
    set(cmsRouteAtom, {
      workspace: nextWorkspace,
      root: keepScope ? route.root : undefined,
      entry: keepScope ? route.entry : undefined
    })
  }
)
