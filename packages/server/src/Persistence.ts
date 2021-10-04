export interface Persistence {
  get(key: string): Promise<Buffer | undefined>
  set(key: string, value: Buffer): Promise<void>
}
