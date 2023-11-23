import {useReducer} from 'react'

export function useForceUpdate() {
  // https://reactjs.org/docs/hooks-faq.html#is-there-something-like-forceupdate
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  return forceUpdate
}
