export interface Previews {
  sign(data: {sub: string}): Promise<string>
  verify(token: string): Promise<{sub: string}>
}
