import {useAtomValue} from 'jotai'
import {dashboardOptionsAtom} from '../atoms/DashboardAtoms.js'

export const useDashboard = () => useAtomValue(dashboardOptionsAtom)
