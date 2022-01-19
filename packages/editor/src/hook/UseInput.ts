import {InputPath} from '../InputPath'

/* eslint-disable */
export function useInput<T>(path: InputPath<T>) {
  return path.use()
}
