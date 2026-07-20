import {type Atom, useAtomValue, useSetAtom} from 'jotai'
import {useEffect, useRef} from 'react'
import {useDashboard} from '../store.js'
import type {DashboardToastInput} from '../store/Dashboard.js'

export function useToastOnChange<T>(
  source: Atom<T>,
  derive: (prev: T | undefined, next: T) => DashboardToastInput | null
): void {
  const dashboard = useDashboard()
  const pushToast = useSetAtom(dashboard.pushToast)
  const value = useAtomValue(source)
  const prevRef = useRef<T | undefined>(undefined)
  const deriveRef = useRef(derive)
  deriveRef.current = derive

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = value
    const input = deriveRef.current(prev, value)
    if (input) pushToast(input)
  }, [value, pushToast])
}
