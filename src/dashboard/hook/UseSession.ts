import {useAtomValue} from 'jotai'
import {sessionAtom} from '../atoms/DashboardAtoms.js'

export const useSession = () => useAtomValue(sessionAtom)!
