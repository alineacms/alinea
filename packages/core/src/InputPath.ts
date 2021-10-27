import {Value} from './Value'

export type InputPath<T> = {
  type: Value<T>
  location: Array<string>
}

export function inputPath<T>(
  type: Value<T>,
  location: Array<string>
): InputPath<T> {
  return {type, location}
}
