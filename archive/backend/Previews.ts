export interface Previews {
  sign(data: {id: string; url: string}): Promise<string>
  verify(token: string): Promise<{id: string; url: string}>
}
