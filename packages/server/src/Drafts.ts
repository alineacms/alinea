export interface Drafts {
  get(id: string, stateVector?: Uint8Array): Promise<Uint8Array | undefined>
  update(id: string, update: Uint8Array): Promise<Drafts.Update>
  delete(ids: Array<string>): Promise<void>
  updates(): AsyncGenerator<Drafts.Update>
}

export namespace Drafts {
  export type Update = {id: string; update: Uint8Array}
}
