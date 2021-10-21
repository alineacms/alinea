import {Type} from './Type'

export type InputPath<T> = {
  type: Type<T>
  location: Array<string>
}

export function inputPath<T>(
  type: Type<T>,
  location: Array<string>
): InputPath<T> {
  return {type, location}
}
