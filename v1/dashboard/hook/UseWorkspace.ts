import {useAtomValue} from 'jotai'
import {workspaceAtom} from '../atoms/NavigationAtoms.js'

export const useWorkspace = () => useAtomValue(workspaceAtom)
