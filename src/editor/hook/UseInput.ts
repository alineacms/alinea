import {InputState} from '../InputState.js'

/* eslint-disable */
export function useInput<T>(path: InputState<T>) {
  return path.use()
}
