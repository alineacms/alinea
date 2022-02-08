import type {ComponentType} from 'react'

export type Root<T = string> = {
  icon: ComponentType
  contains: Array<T>
}

export function root<T>(options: Root<T>): Root<T> {
  return options
}
