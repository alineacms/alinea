export interface Previews {
  sign(data: {id: string}): string
  verify(token: string): {id: string}
}
