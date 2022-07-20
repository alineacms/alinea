export interface Previews {
  sign(data: {id: string}): Promise<string>
  verify(token: string): Promise<{id: string}>
}
