import {useState} from 'react'

type Trigger<T, O> = {
  options: O
  resolve: (value: T | undefined) => void
  reject: () => void
}

export function useTrigger<T, O = undefined>() {
  const [trigger, setTrigger] = useState<Trigger<T, O> | undefined>(undefined)
  return {
    options: trigger?.options,
    isActive: Boolean(trigger),
    request(options: O) {
      return new Promise(
        (resolve: (value: T | undefined) => void, reject: () => void) => {
          setTrigger({options, resolve, reject})
        }
      ).finally(() => {
        setTrigger(undefined)
      })
    },
    resolve(value: T | undefined) {
      if (trigger) trigger.resolve(value)
    },
    reject() {
      if (trigger) trigger.reject()
    }
  }
}
