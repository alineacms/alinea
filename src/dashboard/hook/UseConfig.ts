import {useAtomValue} from 'jotai'
import {configAtom} from '../atoms/DashboardAtoms.js'

export const useConfig = () => useAtomValue(configAtom)
