import * as cito from 'cito'
import {keys} from './Objects.js'

export function hasExact(allowed: Array<string>) {
  return cito.type((value): value is object => {
    return keys(value).every(key => allowed.includes(key))
  })
}
