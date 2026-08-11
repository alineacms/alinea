import {type Atom, useAtomValue, useSetAtom} from 'jotai'
import {useEffect, useRef} from 'react'
import {
  dashboardAtoms,
  type DashboardMutationQueue,
  type DashboardToastInput
} from '../atoms/dashboard.js'

export function useToastOnChange(
  source: Atom<DashboardMutationQueue>,
  derive: (
    prev: DashboardMutationQueue | undefined,
    next: DashboardMutationQueue
  ) => DashboardToastInput | null
): void {
  const pushToast = useSetAtom(dashboardAtoms.pushToast)
  const value = useAtomValue(source)
  const prevRef = useRef<DashboardMutationQueue | undefined>(undefined)
  const deriveRef = useRef(derive)
  deriveRef.current = derive

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = value
    const input = deriveRef.current(prev, value)
    if (input) pushToast(input)
  }, [value, pushToast])
}
