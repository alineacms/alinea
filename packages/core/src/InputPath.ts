// Todo: input path should also contain the base type of the field we're
// targeting
export type InputPath<T> = Array<string> & {__t: T}

export function inputPath<T>(of: Array<string>) {
  return of as InputPath<T>
}
