// Todo: input path should also contain the base type of the field we're
// targeting
export type InputPath<T> = Array<string | number> & {__t: T}

export function inputPath<T>(of: Array<string | number>) {
  return of as InputPath<T>
}
