import {useEffect, useRef} from 'react'

export const useNonInitialEffect: typeof useEffect = (effect, deps?) => {
  const initial = useRef(true)
  useEffect(() => {
    if (initial.current) {
      initial.current = false
      return
    }
    return effect()
    // eslint-disable-next-line
  }, deps)
}
