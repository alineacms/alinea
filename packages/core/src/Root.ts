import type {ComponentType} from 'react'

export type Root<T = string> = {
  contains: Array<T>
  icon?: ComponentType
}

export function root<T>(options: Root<T>): Root<T> {
  return options
}
