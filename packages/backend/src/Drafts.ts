import {Hub} from '@alinea/core/Hub'

export interface Drafts {
  get(
    params: Hub.EntryParams,
    ctx: Hub.Context
  ): Promise<Uint8Array | undefined>
  update(params: Hub.UpdateParams, ctx: Hub.Context): Promise<Drafts.Update>
  delete(params: Hub.DeleteMultipleParams, ctx: Hub.Context): Promise<void>
  updates(params: {}, ctx: Hub.Context): AsyncGenerator<Drafts.Update>
}

export namespace Drafts {
  export type Update = {id: string; update: Uint8Array}
}
