export interface Previews {
  sign(): Promise<string>
  verify(token: string): Promise<void>
}
