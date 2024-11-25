// Source: https://usehooks.com/useLocalStorage/
import {useEffect, useState} from 'react'

// Hook
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  const setValue = (value: T) => {
    try {
      setStoredValue(value)
      if (typeof window !== 'undefined')
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(error)
    }
  }

  function initialize() {
    try {
      const item = window.localStorage.getItem(key)
      setStoredValue(item ? JSON.parse(item) : initialValue)
    } catch (error) {
      console.error(error)
    }
  }
  // Listen to changes to the value
  useEffect(() => {
    initialize()
    window.addEventListener('storage', event => {
      if (event.storageArea === window.localStorage && event.key === key) {
        initialize()
      }
    })
  }, [])

  return [storedValue, setValue] as const
}
