import {atom} from 'jotai'
import {workspaceAtom} from './NavigationAtoms.js'

export const accentColorAtom = atom(get => {
  const {color} = get(workspaceAtom)
  return color
})
