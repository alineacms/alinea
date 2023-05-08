import {Connection} from 'alinea/core'

export interface Drafts {
  get(
    params: Connection.EntryParams,
    ctx: Connection.Context
  ): Promise<Uint8Array | undefined>
  update(
    params: Connection.UpdateParams,
    ctx: Connection.Context
  ): Promise<Drafts.Update>
  delete(
    params: Connection.DeleteMultipleParams,
    ctx: Connection.Context
  ): Promise<void>
  updates(params: {}, ctx: Connection.Context): AsyncGenerator<Drafts.Update>
}

export namespace Drafts {
  export type Update = {id: string; update: Uint8Array}
}
