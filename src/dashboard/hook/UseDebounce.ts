// Source: https://usehooks.com/useDebounce/
// License: https://github.com/uidotdev/usehooks/blob/c3d30c8706b1990f09dbd25cf69c5586e7fe375e/LICENSE

import {useEffect, useState} from 'react'

// Hook
// T is a generic type for value parameter, our case this will be string
export function useDebounce<T>(value: T, delay: number): T {
  // State and setters for debounced value
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(
    () => {
      // Update debounced value after delay
      const handler = setTimeout(() => {
        setDebouncedValue(value)
      }, delay)
      // Cancel the timeout if value changes (also on delay change or unmount)
      // This is how we prevent debounced value from updating if value is changed ...
      // .. within the delay period. Timeout gets cleared and restarted.
      return () => {
        clearTimeout(handler)
      }
    },
    [value, delay] // Only re-call effect if value or delay changes
  )
  return debouncedValue
}
