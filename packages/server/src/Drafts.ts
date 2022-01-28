export interface Drafts {
  get(id: string, stateVector?: Uint8Array): Promise<Uint8Array | undefined>
  update(id: string, update: Uint8Array): Promise<void>
  delete(ids: Array<string>): Promise<void>
  updates(): AsyncGenerator<{id: string; update: Uint8Array}>
}
