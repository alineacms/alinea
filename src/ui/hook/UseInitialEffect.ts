import {useEffect, useRef} from 'react'

export const useInitialEffect: typeof useEffect = effect => {
  const initial = useRef(true)
  useEffect(() => {
    if (!initial.current) return
    initial.current = false
    return effect()
    // eslint-disable-next-line
  }, [])
}
